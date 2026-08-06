import React, { useCallback, useMemo, useState } from "react";
import { FiCheckCircle, FiCornerUpLeft, FiEye, FiPlus, FiX, FiXCircle } from "react-icons/fi";
import {
  approveValidation,
  startValidationSignature,
  completeValidationSignature,
  rejectValidation,
  returnValidationForModification,
} from "../../services/validations.service";
import { Modal } from "../../components/ui/modal";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import PdfPreviewModal from "../../components/common/PdfPreviewModal";
import { emitToast } from "../../services/toastBus";
import { createBudgetLine, listBudgetLines } from "../../services/budgetLines.service";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { agentDisplayName } from "../../utils/validationActors";
import { FIRMA_ENABLED } from "../../utils/firma";
import {
  BUDGET_MONTHS,
  budgetLineOptionLabel,
  budgetWarningForAmount,
  formatBudgetWarning,
} from "../../utils/budgetLines";

const DAF_CRITERE4_LABEL = "Moyen de paiement";
const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_MONTH = new Date().getMonth() + 1;
const EXERCICE_OPTIONS = Array.from({ length: 8 }, (_, index) => CURRENT_YEAR + 2 - index);

function initialBudgetLineForm(overrides = {}) {
  return {
    code: "",
    libelle: "",
    description: "",
    exercice: String(CURRENT_YEAR),
    mois: String(CURRENT_MONTH),
    devise: "FCFA",
    montant_initial: "",
    controle_mode: "SOUPLE",
    statut: "active",
    ...overrides,
  };
}

function buildExerciceOptions(selectedValue) {
  const selected = Number(selectedValue);
  const options = [...EXERCICE_OPTIONS];
  if (Number.isFinite(selected) && selected > 0 && !options.includes(selected)) {
    options.push(selected);
  }
  return Array.from(new Set(options)).sort((a, b) => b - a);
}

function normalizeDafCritere4Input(value) {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (["true", "false", "1", "0", "oui", "non", "yes", "no"].includes(lower)) return "";
    return trimmed;
  }
  return "";
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeConditionSource(value) {
  if (!value) return "DEMANDEUR";
  const v = String(value).trim().toUpperCase();
  return v === "DAF" ? "DAF" : "DEMANDEUR";
}

function normalizeValidationStopRole(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (["DAF", "DGA", "DG"].includes(v)) return v;
  return null;
}

function yesNoLabel(value) {
  const response = normalizeControlResponse(value);
  if (response) return controlResponseLabel(response);
  if (value === true) return "Oui";
  if (value === false) return "Non";
  if (value === 1 || value === "1") return "Oui";
  if (value === 0 || value === "0") return "Non";
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "oui", "yes"].includes(normalized)) return "Oui";
  if (["false", "non", "no"].includes(normalized)) return "Non";
  return "-";
}

function normalizeControlResponse(value) {
  if (value == null || value === "") return null;
  if (value === true) return "OUI";
  if (value === false) return "NON";
  const v = String(value).trim().toUpperCase();
  if (["OUI", "YES", "TRUE", "1"].includes(v)) return "OUI";
  if (["NON", "NO", "FALSE", "0"].includes(v)) return "NON";
  if (["NA", "N/A", "N.A", "N.A.", "N A", "NOT_APPLICABLE"].includes(v)) return "NA";
  return null;
}

function controlResponseLabel(value) {
  const response = normalizeControlResponse(value);
  if (response === "OUI") return "Oui";
  if (response === "NON") return "Non";
  if (response === "NA") return "N/A";
  return "-";
}

function controlResponseToBoolean(value) {
  const response = normalizeControlResponse(value);
  if (response === "OUI") return true;
  if (response === "NON") return false;
  return null;
}

function normalizeDafControlComments(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, raw]) => [key, raw == null ? "" : String(raw).trim()])
      .filter(([, raw]) => raw)
  );
}

function controlComment(comments, key) {
  if (!comments || typeof comments !== "object") return "";
  return comments[key] ? String(comments[key]) : "";
}

function findDafValidationStep(demande) {
  const steps = Array.isArray(demande?.validation_steps) ? demande.validation_steps : [];
  return steps.find((step) => {
    const role = String(step?.role_name || "").trim().toUpperCase();
    return role === "DAF" && (step?.validated_by_id != null || step?.validated_at);
  });
}

function formatDafValidation(summary, demande) {
  const dafStep = findDafValidationStep(demande);
  const summaryName = summary?.daf_validated_by_name ? String(summary.daf_validated_by_name).trim() : "";
  const stepName = agentDisplayName(dafStep?.agents_validation_steps_validated_by_idToagents);
  const name = summaryName || (stepName !== "-" ? stepName : "");
  const rawDate = summary?.daf_validated_at || dafStep?.validated_at || "";
  const date = rawDate ? formatDateTime(rawDate) : "";
  if (name && date && date !== "-") return `${name} - ${date}`;
  if (name) return name;
  return date && date !== "-" ? date : "-";
}

export default function ValidationActionModal({ open, mode, item, onClose, onDone }) {
  // mode: "approve" | "reject" | "return"
  const makeDafCondition = (index, overrides = {}) => ({
    label: `Tranche ${index + 1}`,
    mode: "pct", // "pct" | "amount"
    pourcentage: "",
    montant_prevu: "",
    condition_texte: "",
    ...overrides,
  });

  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [signatureRequestId, setSignatureRequestId] = useState("");
  const [signatureUserId, setSignatureUserId] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [signatureCompleting, setSignatureCompleting] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const role = useMemo(() => String(item?.role_name || "").toUpperCase(), [item?.role_name]);
  const demande = item?.demandes_paiement || null;
  const dafSummary = demande?.daf_validation_summary || demande || {};
  const dafSummaryComments = normalizeDafControlComments(dafSummary?.daf_controle_commentaires);
  const isDaf = role === "DAF";
  const isDga = role === "DGA";
  const isSigning = Boolean(signatureUrl);
  const hasDafControlSummary =
    mode === "approve" &&
    isDga &&
    [
      dafSummary?.motif,
      dafSummary?.daf_validated_by_name,
      dafSummary?.daf_validated_at,
      dafSummary?.validation_oci,
      dafSummary?.validation_oci_reponse,
      dafSummary?.paiement_immediat,
      dafSummary?.paiement_immediat_reponse,
      dafSummary?.budget_prevu,
      dafSummary?.budget_prevu_reponse,
      dafSummary?.budget_disponible,
      dafSummary?.budget_disponible_reponse,
      dafSummary?.daf_critere4,
    ].some((value) => value !== null && value !== undefined && String(value).trim() !== "");
  const demandeurConditions = useMemo(() => {
    const list = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    return list.filter((c) => normalizeConditionSource(c?.source) === "DEMANDEUR");
  }, [demande?.conditions_paiement]);
  const dafExisting = useMemo(() => {
    const list = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    return list.filter((c) => normalizeConditionSource(c?.source) === "DAF");
  }, [demande?.conditions_paiement]);

  const [budgetPrevu, setBudgetPrevu] = useState(null); // null | OUI | NON | NA
  const [budgetDisponible, setBudgetDisponible] = useState(null); // null | OUI | NON | NA
  const [paiementImmediat, setPaiementImmediat] = useState(null); // null | OUI | NON | NA
  const [validationOci, setValidationOci] = useState(null); // null | OUI | NON | NA
  const [ligneBudgetaireResponse, setLigneBudgetaireResponse] = useState("OUI"); // OUI | NON | NA
  const [dafControlComments, setDafControlComments] = useState({});
  const [dafCritere4, setDafCritere4] = useState(""); // string (moyen de paiement)
  const [validationStopRole, setValidationStopRole] = useState("DG"); // DAF | DGA | DG
  const [dafConditionsChoice, setDafConditionsChoice] = useState("daf"); // "daf" | "demandeur"
  const [dafConditionsMode, setDafConditionsMode] = useState("100/100"); // 100/100 | 70/30 | 50/50 | custom
  const [dafConditions, setDafConditions] = useState([makeDafCondition(0)]);
  const [budgetLines, setBudgetLines] = useState([]);
  const [budgetLinesLoading, setBudgetLinesLoading] = useState(false);
  const [ligneBudgetaireId, setLigneBudgetaireId] = useState("");
  const [budgetLineCreateOpen, setBudgetLineCreateOpen] = useState(false);
  const [budgetLineCreateSaving, setBudgetLineCreateSaving] = useState(false);
  const [budgetLineForm, setBudgetLineForm] = useState(() => initialBudgetLineForm());

  const commentaireRequired =
    mode === "reject" ||
    mode === "return" ||
    (mode === "approve" && isDaf && (validationOci === "NON" || paiementImmediat === "NON"));
  const commentairePlaceholder =
    mode === "reject"
      ? "Motif du rejet (obligatoire)"
      : mode === "return"
        ? "Motif du retour pour modification (obligatoire)"
        : mode === "approve" && isDaf && validationOci === "NON"
          ? "Commentaire obligatoire si Validé par OCI = Non"
          : mode === "approve" && isDaf && paiementImmediat === "NON"
            ? "Commentaire obligatoire si paiement non immédiat"
            : "Optionnel";

  const totalMontant = useMemo(() => {
    const raw = demande?.montant_net != null ? demande.montant_net : demande?.montant;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [demande?.montant_net, demande?.montant]);

  const formatAmount = (value) =>
    Number.isFinite(Number(value)) ? `${formatMoney(Number(value))} FCFA` : "-";

  const refreshBudgetLines = useCallback(async (selectId = null) => {
    setBudgetLinesLoading(true);
    try {
      const res = await listBudgetLines({ activeOnly: true });
      const list = res?.success && Array.isArray(res.data) ? res.data : [];
      setBudgetLines(list);
      if (selectId) {
        setLigneBudgetaireId(String(selectId));
      }
      return list;
    } catch {
      setBudgetLines([]);
      return [];
    } finally {
      setBudgetLinesLoading(false);
    }
  }, []);

  const computeConditionsPctSum = (conditions, total) => {
    const list = Array.isArray(conditions) ? conditions : [];
    let sum = 0;
    let hasAny = false;
    const totalNum = Number(total);

    for (const c of list) {
      const pct = Number(c?.pourcentage);
      if (Number.isFinite(pct)) {
        sum += pct;
        hasAny = true;
        continue;
      }
      const montant = Number(c?.montant_prevu);
      if (Number.isFinite(montant) && Number.isFinite(totalNum) && totalNum > 0) {
        sum += (montant / totalNum) * 100;
        hasAny = true;
      }
    }

    return { sum, hasAny };
  };

  const demandeurSumInfo = useMemo(() => {
    return computeConditionsPctSum(demandeurConditions, totalMontant);
  }, [demandeurConditions, totalMontant]);

  const demandeurSumValid =
    demandeurSumInfo.hasAny && Math.abs(Number(demandeurSumInfo.sum) - 100) <= 0.01;

  const customSumInfo = useMemo(() => {
    return computeConditionsPctSum(dafConditions, totalMontant);
  }, [dafConditions, totalMontant]);

  const customSumValid =
    customSumInfo.hasAny && Math.abs(Number(customSumInfo.sum) - 100) <= 0.01;

  const partsForMode = useMemo(() => {
    if (dafConditionsMode === "70/30") return [70, 30];
    if (dafConditionsMode === "50/50") return [50, 50];
    if (dafConditionsMode === "100/100") return [100];
    return [];
  }, [dafConditionsMode]);

  const title = useMemo(() => {
    if (mode === "approve") return "Valider la demande";
    if (mode === "reject") return "Rejeter la demande";
    return "Retourner pour modification";
  }, [mode]);

  const headerTitle = mode === "approve" && isSigning ? "Signature electronique" : title;
  const headerSubtitle =
    mode === "approve" && isSigning
      ? "Signez pour valider definitivement la demande."
      : mode === "approve"
        ? "Ajouter un commentaire si besoin."
        : mode === "reject"
        ? "Commentaire obligatoire pour le rejet."
        : "Commentaire obligatoire (motif du retour).";
  const errorMessage = signatureError || error;

  const close = (opts = {}) => {
    if (submitting) return;
    if (signatureCompleting && !opts.force) return;
    setCommentaire("");
    setBudgetPrevu(null);
    setBudgetDisponible(null);
    setPaiementImmediat(null);
    setValidationOci(null);
    setLigneBudgetaireResponse("OUI");
    setDafControlComments({});
    setDafCritere4("");
    setValidationStopRole("DG");
    setDafConditionsChoice("daf");
    setDafConditionsMode("100/100");
    setDafConditions([makeDafCondition(0)]);
    setBudgetLines([]);
    setBudgetLinesLoading(false);
    setLigneBudgetaireId("");
    setBudgetLineCreateOpen(false);
    setBudgetLineCreateSaving(false);
    setBudgetLineForm(initialBudgetLineForm());
    setError("");
    setSignatureUrl("");
    setSignatureRequestId("");
    setSignatureUserId("");
    setSignatureError("");
    setSignatureCompleting(false);
    onClose?.();
  };

  // Pré-remplissage (utile si la demande a déjà une valeur)
  React.useEffect(() => {
    if (!open) return;
    if (!isDaf) return;
    setBudgetPrevu(normalizeControlResponse(demande?.budget_prevu_reponse ?? demande?.budget_prevu));
    setBudgetDisponible(normalizeControlResponse(demande?.budget_disponible_reponse ?? demande?.budget_disponible));
    setPaiementImmediat(normalizeControlResponse(demande?.paiement_immediat_reponse ?? demande?.paiement_immediat));
    setValidationOci(normalizeControlResponse(demande?.validation_oci_reponse ?? demande?.validation_oci));
    setLigneBudgetaireResponse(
      normalizeControlResponse(demande?.ligne_budgetaire_reponse ?? (demande?.ligne_budgetaire_id ? "OUI" : null)) || "OUI"
    );
    setDafControlComments(normalizeDafControlComments(demande?.daf_controle_commentaires));
    setDafCritere4(normalizeDafCritere4Input(demande?.daf_critere4));
    setValidationStopRole(normalizeValidationStopRole(demande?.validation_stop_role) || "DG");
    setLigneBudgetaireId(demande?.ligne_budgetaire_id ? String(demande.ligne_budgetaire_id) : "");
    if (dafExisting.length > 0) {
      setDafConditionsChoice("daf");
      setDafConditionsMode("custom");
      setDafConditions(
        dafExisting.map((c, idx) => {
          const pctStr = c?.pourcentage != null ? String(c.pourcentage) : "";
          const montantStr = c?.montant_prevu != null ? String(c.montant_prevu) : "";
          const mode = montantStr && !pctStr ? "amount" : "pct";
          return makeDafCondition(idx, {
            mode,
            pourcentage: pctStr,
            montant_prevu: montantStr,
            condition_texte: c?.condition_texte ? String(c.condition_texte) : "",
          });
        })
      );
    } else {
      setDafConditionsChoice(demandeurConditions.length > 0 ? "demandeur" : "daf");
      setDafConditionsMode("100/100");
      setDafConditions([makeDafCondition(0)]);
    }
  }, [
    open,
    isDaf,
    demande?.budget_prevu,
    demande?.budget_prevu_reponse,
    demande?.budget_disponible,
    demande?.budget_disponible_reponse,
    demande?.paiement_immediat,
    demande?.paiement_immediat_reponse,
    demande?.validation_oci,
    demande?.validation_oci_reponse,
    demande?.daf_critere4,
    demande?.validation_stop_role,
    demande?.ligne_budgetaire_id,
    demande?.ligne_budgetaire_reponse,
    demande?.daf_controle_commentaires,
    dafExisting,
    demandeurConditions.length,
  ]);

  React.useEffect(() => {
    if (!open || !isDaf || mode !== "approve") return;
    let active = true;
    const loadBudgetLines = async () => {
      const list = await refreshBudgetLines();
      if (!active) return;
      setBudgetLines(list);
    };
    loadBudgetLines();
    return () => {
      active = false;
    };
  }, [open, isDaf, mode, refreshBudgetLines]);

  const selectedBudgetLine = useMemo(() => {
    if (ligneBudgetaireResponse !== "OUI") return null;
    const selected = budgetLines.find((line) => Number(line.id) === Number(ligneBudgetaireId));
    if (selected) return selected;
    const assigned = demande?.lignes_budgetaires || null;
    if (assigned && Number(assigned.id) === Number(ligneBudgetaireId)) return assigned;
    return null;
  }, [budgetLines, ligneBudgetaireId, demande?.lignes_budgetaires, ligneBudgetaireResponse]);

  const budgetWarning = useMemo(() => {
    return budgetWarningForAmount(selectedBudgetLine, totalMontant);
  }, [selectedBudgetLine, totalMontant]);

  const openBudgetLineCreate = () => {
    setBudgetLineForm(
      initialBudgetLineForm({
        montant_initial: totalMontant > 0 ? String(totalMontant) : "",
        libelle: demande?.motif ? String(demande.motif).slice(0, 140) : "",
      })
    );
    setBudgetLineCreateOpen(true);
  };

  const saveBudgetLineFromValidation = async () => {
    const libelle = String(budgetLineForm.libelle || "").trim();
    const montantInitial = Number(budgetLineForm.montant_initial);
    if (!libelle) {
      emitToast({ variant: "error", message: "Libellé de ligne budgétaire obligatoire" });
      return;
    }
    if (!Number.isFinite(montantInitial) || montantInitial < 0) {
      emitToast({ variant: "error", message: "Montant initial invalide" });
      return;
    }

    const payload = {
      code: String(budgetLineForm.code || "").trim() || undefined,
      libelle,
      description: String(budgetLineForm.description || "").trim() || null,
      exercice: Number(budgetLineForm.exercice || CURRENT_YEAR),
      mois: Number(budgetLineForm.mois || CURRENT_MONTH),
      devise: String(budgetLineForm.devise || "FCFA").trim().toUpperCase(),
      montant_initial: montantInitial,
      controle_mode: budgetLineForm.controle_mode || "SOUPLE",
      statut: budgetLineForm.statut || "active",
      scope_type: "GLOBAL",
      scope_id: null,
    };

    setBudgetLineCreateSaving(true);
    try {
      const res = await createBudgetLine(payload);
      if (!res?.success) throw new Error(res?.message || "Erreur création ligne budgétaire");
      const created = res.data;
      emitToast({ variant: "success", message: "Ligne budgétaire créée" });
      setBudgetLineCreateOpen(false);
      setBudgetLineForm(initialBudgetLineForm());
      await refreshBudgetLines(created?.id || null);
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur création ligne budgétaire" });
    } finally {
      setBudgetLineCreateSaving(false);
    }
  };

  const addDafCondition = () => {
    setDafConditions((prev) => [
      ...prev,
      makeDafCondition(prev.length),
    ]);
  };

  const removeDafCondition = (index) => {
    if (dafConditions.length <= 1) return;
    setDafConditions((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((c, idx) => ({ ...c, label: `Tranche ${idx + 1}` }))
    );
  };

  const setDafCondition = (index, field, value) => {
    setDafConditions((prev) =>
      prev.map((c, idx) => {
        if (idx !== index) return c;
        if (field === "mode") {
          return {
            ...c,
            mode: value,
            pourcentage: value === "pct" ? c.pourcentage : "",
            montant_prevu: value === "amount" ? c.montant_prevu : "",
          };
        }
        return { ...c, [field]: value };
      })
    );
  };

  const copyDemandeurConditions = () => {
    if (!demandeurConditions.length) return;
    setDafConditionsChoice("daf");
    setDafConditionsMode("custom");
    setDafConditions(
      demandeurConditions.map((c, idx) => {
        const montantNum = c?.montant_prevu != null ? Number(c.montant_prevu) : null;
        const pct =
          c?.pourcentage != null
            ? Number(c.pourcentage)
            : totalMontant > 0 && montantNum != null
              ? (montantNum / totalMontant) * 100
              : null;
        const pctStr = Number.isFinite(pct) ? String(Math.round(pct * 100) / 100) : "";
        const mode = montantNum != null && !Number.isFinite(Number(c?.pourcentage)) ? "amount" : "pct";
        return makeDafCondition(idx, {
          mode,
          pourcentage: pctStr,
          montant_prevu: montantNum != null ? String(montantNum) : "",
          condition_texte: c?.condition_texte ? String(c.condition_texte) : "",
        });
      })
    );
  };

  const setDafControlComment = (key, value) => {
    setDafControlComments((current) => ({ ...current, [key]: value }));
  };

  const dafNaCommentFields = useMemo(
    () =>
      [
        { key: "budget_prevu", label: "Prévu au budget", value: budgetPrevu },
        { key: "budget_disponible", label: "Budget disponible", value: budgetDisponible },
        { key: "validation_oci", label: "Validé par OCI", value: validationOci },
        { key: "paiement_immediat", label: "Paiement immédiat", value: paiementImmediat },
        { key: "ligne_budgetaire", label: "Ligne budgétaire", value: ligneBudgetaireResponse },
      ].filter((field) => field.value === "NA"),
    [budgetDisponible, budgetPrevu, ligneBudgetaireResponse, paiementImmediat, validationOci]
  );

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSignatureError("");

    try {
      setSubmitting(true);
      const id = item?.id;
      if (!id) throw new Error("Validation ID manquant");

      const commentaireTrimmed = (commentaire || "").trim();
      if ((mode === "reject" || mode === "return") && !commentaireTrimmed) {
        throw new Error("Commentaire obligatoire");
      }

      let dafExtraPayload = {};
      let cleanedDafControlComments = {};
      if (mode === "approve" && isDaf) {
        if (
          !budgetPrevu ||
          !budgetDisponible ||
          !paiementImmediat ||
          !validationOci ||
          !ligneBudgetaireResponse ||
          !dafCritere4 ||
          (ligneBudgetaireResponse === "OUI" && !ligneBudgetaireId)
        ) {
          throw new Error(
            "Contrôle DAF : renseignez Budget prévu, Budget disponible, Paiement immédiat, Validation OCI, Moyen de paiement et Ligne budgétaire"
          );
        }

        const dafControlResponses = {
          budget_prevu: budgetPrevu,
          budget_disponible: budgetDisponible,
          paiement_immediat: paiementImmediat,
          validation_oci: validationOci,
          ligne_budgetaire: ligneBudgetaireResponse,
        };
        for (const [key, value] of Object.entries(dafControlResponses)) {
          if (value === "NA" && !String(dafControlComments[key] || "").trim()) {
            throw new Error("Commentaire obligatoire pour chaque champ DAF en N/A");
          }
        }
        cleanedDafControlComments = Object.fromEntries(
          Object.entries(normalizeDafControlComments(dafControlComments)).filter(
            ([key]) => dafControlResponses[key] === "NA"
          )
        );

        const stopRoleNormalized = normalizeValidationStopRole(validationStopRole);
        if (!stopRoleNormalized) throw new Error("Catégorie de validation invalide");

        if (validationOci === "NON" && !commentaireTrimmed) {
          throw new Error("Commentaire obligatoire si Validation OCI = Non");
        }

        if (paiementImmediat === "NON") {
          if (!commentaireTrimmed) throw new Error("Commentaire obligatoire si paiement non immédiat");

          if (dafConditionsChoice === "demandeur") {
            if (!demandeurConditions.length) {
              throw new Error("Aucune condition de paiement du demandeur");
            }
            if (!demandeurSumValid) {
              throw new Error("Conditions du demandeur: la somme des pourcentages doit etre 100%");
            }
            dafExtraPayload = { conditions_paiement_use_demandeur: true };
          } else {
            if (dafConditionsMode === "custom") {
              const active = dafConditions.filter((c) => {
                const pct = String(c.pourcentage || "").trim();
                const montant = String(c.montant_prevu || "").trim();
                const txt = String(c.condition_texte || "").trim();
                return pct || montant || txt;
              });
              if (!active.length) {
                throw new Error("Definir les conditions de paiement");
              }
              let sumPct = 0;
              const custom = active.map((c, idx) => {
                const label = `Tranche ${idx + 1}`;
                const modeValue = c.mode === "amount" ? "amount" : "pct";
                let pctNum = null;
                if (modeValue === "amount") {
                  const montantNum = toNumber(c.montant_prevu);
                  if (montantNum == null || montantNum <= 0) {
                    throw new Error(`Montant invalide (tranche ${idx + 1})`);
                  }
                  if (!totalMontant || totalMontant <= 0) {
                    throw new Error("Montant total invalide pour calculer les pourcentages");
                  }
                  pctNum = (montantNum / totalMontant) * 100;
                } else {
                  pctNum = toNumber(c.pourcentage);
                  if (pctNum == null || pctNum <= 0) {
                    throw new Error(`Pourcentage invalide (tranche ${idx + 1})`);
                  }
                }
                sumPct += pctNum;
                return {
                  label,
                  pourcentage: pctNum,
                  condition_texte: String(c.condition_texte || "").trim() || null,
                };
              });
              if (Math.abs(sumPct - 100) > 0.01) {
                throw new Error("La somme des pourcentages doit etre 100%");
              }
              dafExtraPayload = { conditions_paiement_custom: custom };
            } else {
              dafExtraPayload = { conditions_paiement_mode: dafConditionsMode };
            }
          }
        }

        dafExtraPayload = {
          ...dafExtraPayload,
          validation_stop_role: stopRoleNormalized,
          ligne_budgetaire_reponse: ligneBudgetaireResponse,
          ...(ligneBudgetaireResponse === "OUI" ? { ligne_budgetaire_id: Number(ligneBudgetaireId) } : {}),
        };
      }

      if (mode === "approve") {
        const approvePayload = {
          ...(commentaireTrimmed ? { commentaire: commentaireTrimmed } : {}),
          ...(isDaf
            ? {
                budget_prevu: controlResponseToBoolean(budgetPrevu),
                budget_disponible: controlResponseToBoolean(budgetDisponible),
                paiement_immediat: controlResponseToBoolean(paiementImmediat),
                validation_oci: controlResponseToBoolean(validationOci),
                budget_prevu_reponse: budgetPrevu,
                budget_disponible_reponse: budgetDisponible,
                paiement_immediat_reponse: paiementImmediat,
                validation_oci_reponse: validationOci,
                daf_controle_commentaires: cleanedDafControlComments,
                daf_critere4: dafCritere4 ? String(dafCritere4).trim() : null,
                ...dafExtraPayload, // Envoyer le moyen de paiement comme chaîne
              }
            : {}),
        };

        if (!FIRMA_ENABLED) {
          const res = await approveValidation(id, approvePayload);
          if (!res?.success) throw new Error(res?.message || "Validation impossible");
          emitToast({ variant: "success", message: "Validation effectuée" });
          onDone?.();
          close();
          return;
        }

        const res = await startValidationSignature(id, approvePayload);
        if (!res?.success) throw new Error(res?.message || "Signature impossible");
        const data = res?.data || {};
        const signingUrl = data.signingUrl || data.signing_url;
        if (!signingUrl) throw new Error("Lien de signature introuvable");
        setSignatureUrl(signingUrl);
        setSignatureRequestId(data.signingRequestId || data.signing_request_id || "");
        setSignatureUserId(data.signingRequestUserId || data.signing_request_user_id || "");
        setSignatureError("");
        return;
      }

      const res =
        mode === "reject"
          ? await rejectValidation(id, { commentaire: commentaireTrimmed })
          : await returnValidationForModification(id, { commentaire: commentaireTrimmed });

      if (!res?.success) throw new Error(res?.message || "Action échouée");
      emitToast({
        variant: "success",
        message: mode === "reject" ? "Demande rejetée" : "Demande retournée pour modification",
      });
      onDone?.();
      close();
    } catch (err) {
      const msg = err?.message || "Erreur inconnue";
      setError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const completeSignature = useCallback(async () => {
    if (!item?.id) return;
    if (signatureCompleting) return;
    setSignatureError("");

    try {
      setSignatureCompleting(true);
      const res = await completeValidationSignature(item.id);
      if (!res?.success) throw new Error(res?.message || "Signature non terminee");

      emitToast({ variant: "success", message: "Validation effectuée" });
      onDone?.();
      close({ force: true });
    } catch (err) {
      const msg = err?.message || "Erreur inconnue";
      setSignatureError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setSignatureCompleting(false);
    }
  }, [item?.id, signatureCompleting, onDone, close]);

  React.useEffect(() => {
    if (!signatureUrl) return undefined;

    const handler = (event) => {
      if (event.origin !== "https://app.firma.dev") return;
      const type = event?.data?.type;
      if (!type) return;
      if (type === "signing.completed") {
        completeSignature();
        return;
      }
      if (type === "signing.declined") {
        setSignatureError("Signature refusee.");
      }
      if (type === "signing.failed") {
        setSignatureError("Signature echouee.");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [signatureUrl, completeSignature]);

  if (!open) return null;

  return (
    <>
    <Modal
      isOpen={open}
      onClose={close}
      showCloseButton={false}
      className={`w-full ${
        isSigning ? "max-w-4xl" : mode === "approve" && isDaf ? "max-w-2xl" : "max-w-xl"
      } max-h-[calc(100vh-2rem)] overflow-hidden rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800`}
    >
        <FullscreenLoader
          show={submitting || signatureCompleting}
          label={signatureCompleting ? "Validation..." : "Traitement..."}
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{headerTitle}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{headerSubtitle}</p>
          </div>

          <button
            type="button"
            disabled={submitting || signatureCompleting}
            title="Fermer"
            aria-label="Fermer"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={close}
          >
            <FiX />
          </button>
        </div>

        {errorMessage ? (
          <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {errorMessage}
          </div>
        ) : null}

        {mode === "approve" && isSigning ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              <div>Signer pour valider la demande.</div>
              {signatureRequestId || signatureUserId ? (
                <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  Ref: {signatureRequestId || signatureUserId}
                </div>
              ) : null}
            </div>

            <div className="h-[520px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
              <iframe
                title="Signature Firma"
                src={signatureUrl}
                className="h-full w-full"
                allow="clipboard-read; clipboard-write"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>Si la signature ne s'affiche pas, ouvrez dans un nouvel onglet.</span>
              {signatureUrl ? (
                <a
                  href={signatureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-200"
                >
                  Ouvrir
                </a>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={close}
                disabled={submitting || signatureCompleting}
                title="Annuler"
                aria-label="Annuler"
                className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FiX />
              </button>

              <button
                type="button"
                onClick={completeSignature}
                disabled={signatureCompleting}
                title="J'ai signe"
                aria-label="J'ai signe"
                className="inline-flex items-center justify-center p-2 rounded-lg text-white hover:opacity-90 disabled:opacity-60 bg-gray-900 dark:bg-white dark:text-gray-900"
              >
                <FiCheckCircle />
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={onSubmit} className="mt-4 max-h-[calc(100vh-11rem)] space-y-4 overflow-y-auto pr-1 pb-1">
          {hasDafControlSummary ? (
            <div className="p-4 border border-blue-200 bg-blue-50 rounded-xl text-sm dark:border-blue-500/30 dark:bg-blue-500/10">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-medium text-blue-950 dark:text-blue-100">Synthèse du contrôle DAF</div>
                {demande?.uuid ? (
                  <button
                    type="button"
                    onClick={() => setPdfPreviewOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-medium text-blue-900 hover:bg-blue-100 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-100 dark:hover:bg-blue-500/20"
                  >
                    <FiEye />
                    Prévisualiser la fiche PDF
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DafSummaryItem label="Motif" value={dafSummary?.motif || demande?.motif || "-"} />
                <DafSummaryItem label="Validation DAF" value={formatDafValidation(dafSummary, demande)} />
                <DafSummaryItem label="Validé par OCI" value={yesNoLabel(dafSummary?.validation_oci_reponse ?? dafSummary?.validation_oci)} comment={controlComment(dafSummaryComments, "validation_oci")} />
                <DafSummaryItem label="Paiement immédiat" value={yesNoLabel(dafSummary?.paiement_immediat_reponse ?? dafSummary?.paiement_immediat)} comment={controlComment(dafSummaryComments, "paiement_immediat")} />
                <DafSummaryItem label="Budget prévu" value={yesNoLabel(dafSummary?.budget_prevu_reponse ?? dafSummary?.budget_prevu)} comment={controlComment(dafSummaryComments, "budget_prevu")} />
                <DafSummaryItem label="Budget dispo" value={yesNoLabel(dafSummary?.budget_disponible_reponse ?? dafSummary?.budget_disponible)} comment={controlComment(dafSummaryComments, "budget_disponible")} />
                <DafSummaryItem label={DAF_CRITERE4_LABEL} value={normalizeDafCritere4Input(dafSummary?.daf_critere4) || "-"} />
              </div>
            </div>
          ) : null}

          {mode === "approve" && isDaf ? (
            <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Contrôle DAF</div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <YesNo
                  label="Prévu au budget ?"
                  value={budgetPrevu}
                  onChange={setBudgetPrevu}
                />
                <YesNo
                  label="Budget disponible ?"
                  value={budgetDisponible}
                  onChange={setBudgetDisponible}
                />
                <YesNo
                  label="Validé par OCI ?"
                  value={validationOci}
                  onChange={setValidationOci}
                />
                <YesNo
                  label="Paiement immédiat ?"
                  value={paiementImmediat}
                  onChange={setPaiementImmediat}
                />
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">{DAF_CRITERE4_LABEL}</div>
                  <select
                    value={dafCritere4 || ""}
                    onChange={(e) => setDafCritere4(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="">Sélectionnez un moyen</option>
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="OM">OM</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Cartes de recharges">Cartes de recharges</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Catégorie de validation</div>
                  <select
                    value={validationStopRole}
                    onChange={(e) => setValidationStopRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="DG">Parcours complet (DG)</option>
                    <option value="DGA">Jusqu'au DGA</option>
                    <option value="DAF">Jusqu'au DAF</option>
                  </select>
                </div>
                <YesNo
                  label="Ligne budgétaire ?"
                  value={ligneBudgetaireResponse}
                  onChange={(next) => {
                    setLigneBudgetaireResponse(next);
                    if (next !== "OUI") setLigneBudgetaireId("");
                  }}
                />
                {ligneBudgetaireResponse === "OUI" ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-600 dark:text-gray-300">Ligne budgétaire</div>
                    {!budgetLinesLoading ? (
                      <button
                        type="button"
                        onClick={openBudgetLineCreate}
                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 dark:border-brand-800 dark:text-brand-300 dark:hover:bg-brand-500/10"
                      >
                        <FiPlus />
                        Créer une ligne
                      </button>
                    ) : null}
                  </div>
                  <select
                    value={ligneBudgetaireId}
                    onChange={(e) => setLigneBudgetaireId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                    disabled={budgetLinesLoading}
                  >
                    <option value="">
                      {budgetLinesLoading ? "Chargement..." : "Sélectionnez une ligne budgétaire"}
                    </option>
                    {budgetLines.map((line) => (
                      <option key={line.id} value={line.id}>
                        {budgetLineOptionLabel(line)}
                      </option>
                    ))}
                  </select>
                  {!budgetLinesLoading && budgetLines.length === 0 ? (
                    <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-amber-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-amber-300">
                      Aucune ligne budgétaire active disponible. Créez une ligne avant de procéder à la validation DAF.
                    </div>
                  ) : null}
                  {selectedBudgetLine ? (
                    <div
                      className={`mt-2 rounded-lg px-3 py-2 text-xs ${
                        budgetWarning?.exceeded
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      }`}
                    >
                      {formatBudgetWarning(selectedBudgetLine, totalMontant)}
                      {budgetWarning?.exceeded ? " Le dépassement est autorisé en mode souple." : null}
                    </div>
                  ) : null}
                </div>
                ) : null}
              </div>

              {dafNaCommentFields.length ? (
                <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
                    Commentaires obligatoires pour les champs en N/A
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {dafNaCommentFields.map((field) => (
                      <label key={field.key} className="block">
                        <span className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-200">
                          {field.label}
                        </span>
                        <textarea
                          value={controlComment(dafControlComments, field.key)}
                          onChange={(e) => setDafControlComment(field.key, e.target.value)}
                          rows={1}
                          placeholder="Commentaire obligatoire"
                          className="mt-1 min-h-10 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-blue-500/30 dark:bg-gray-950"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {paiementImmediat === "NON" ? (
                <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="text-xs text-gray-600 dark:text-gray-300">Conditions de paiement</div>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="daf-conditions-choice"
                        checked={dafConditionsChoice === "demandeur"}
                        disabled={!demandeurConditions.length}
                        onChange={() => setDafConditionsChoice("demandeur")}
                      />
                      Utiliser les conditions du demandeur
                    </label>
                    {!demandeurConditions.length ? (
                      <div className="text-xs text-amber-600">Aucune condition du demandeur disponible.</div>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="daf-conditions-choice"
                        checked={dafConditionsChoice === "daf"}
                        onChange={() => setDafConditionsChoice("daf")}
                      />
                      Modifier ou créer des conditions DAF
                    </label>
                  </div>

                  {dafConditionsChoice === "demandeur" ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Base: {formatMoney(totalMontant)} FCFA
                      </div>
                      <div
                        className={`text-xs ${
                          demandeurSumValid ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        Somme des pourcentages:{" "}
                        {demandeurSumInfo.hasAny ? `${demandeurSumInfo.sum.toFixed(2)}%` : "-"}{" "}
                        (doit faire 100%)
                      </div>
                      {demandeurConditions.map((c, idx) => {
                        const pctNum = Number(c?.pourcentage);
                        const amount =
                          Number.isFinite(Number(c?.montant_prevu))
                            ? Number(c.montant_prevu)
                            : Number.isFinite(pctNum) && totalMontant > 0
                              ? (totalMontant * pctNum) / 100
                              : null;
                        return (
                          <div
                            key={`${c?.id || "dem"}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-200"
                          >
                            <div className="font-medium">{c?.label || `Tranche ${idx + 1}`}</div>
                            <div>{Number.isFinite(pctNum) ? `${pctNum}%` : "-"}</div>
                            <div>{formatAmount(amount)}</div>
                            <div className="text-gray-500 dark:text-gray-400">{c?.condition_texte || "-"}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <select
                        value={dafConditionsMode}
                        onChange={(e) => setDafConditionsMode(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                      >
                        <option value="100/100">100/100</option>
                        <option value="70/30">70/30</option>
                        <option value="50/50">50/50</option>
                        <option value="custom">Personnalisé</option>
                      </select>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Base: {formatMoney(totalMontant)} FCFA
                        </div>
                        {demandeurConditions.length ? (
                          <button
                            type="button"
                            onClick={copyDemandeurConditions}
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                          >
                            Copier conditions du demandeur
                          </button>
                        ) : null}
                      </div>

                      {dafConditionsMode !== "custom" && partsForMode.length ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          {partsForMode.map((p, idx) => (
                            <div key={`${p}-${idx}`} className="flex items-center justify-between gap-2">
                              <span>{`Tranche ${idx + 1} (${p}%)`}</span>
                              <span>{formatAmount((totalMontant * p) / 100)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {dafConditionsMode === "custom" ? (
                        <div className="mt-3 space-y-2">
                          <div
                            className={`text-xs ${
                              !customSumInfo.hasAny
                                ? "text-gray-500 dark:text-gray-400"
                                : customSumValid
                                  ? "text-emerald-600"
                                  : "text-red-600"
                            }`}
                          >
                            Somme des pourcentages:{" "}
                            {customSumInfo.hasAny ? `${customSumInfo.sum.toFixed(2)}%` : "-"} (doit faire 100%)
                          </div>
                          {dafConditions.map((c, idx) => (
                            <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                              <input
                                value={c.label || `Tranche ${idx + 1}`}
                                readOnly
                                className="sm:col-span-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
                              />
                              <select
                                value={c.mode || "pct"}
                                onChange={(e) => setDafCondition(idx, "mode", e.target.value)}
                                className="sm:col-span-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                              >
                                <option value="pct">%</option>
                                <option value="amount">Montant</option>
                              </select>
                              {c.mode === "amount" ? (
                                <input
                                  value={c.montant_prevu}
                                  onChange={(e) => setDafCondition(idx, "montant_prevu", e.target.value)}
                                  className="sm:col-span-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                  placeholder="Montant"
                                />
                              ) : (
                              <input
                                value={c.pourcentage}
                                onChange={(e) => setDafCondition(idx, "pourcentage", e.target.value)}
                                className="sm:col-span-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                placeholder="%"
                              />
                              )}
                              <input
                                value={c.condition_texte}
                                onChange={(e) => setDafCondition(idx, "condition_texte", e.target.value)}
                                className="sm:col-span-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                placeholder="Condition (optionnel)"
                              />
                              <div className="sm:col-span-6 text-xs text-gray-500 dark:text-gray-400">
                                {c.mode === "amount" ? "Pourcentage" : "Montant prévu"}:{" "}
                                {c.mode === "amount"
                                  ? `${Number.isFinite(toNumber(c.montant_prevu)) && totalMontant > 0
                                      ? ((Number(c.montant_prevu) / totalMontant) * 100).toFixed(2)
                                      : "-"}%`
                                  : formatAmount(
                                      Number.isFinite(toNumber(c.pourcentage)) && totalMontant > 0
                                        ? (totalMontant * Number(c.pourcentage)) / 100
                                        : null
                                    )}
                              </div>
                              <div className="sm:col-span-6 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeDafCondition(idx)}
                                  disabled={dafConditions.length <= 1}
                                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
                                >
                                  Retirer
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={addDafCondition}
                              className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                            >
                              Ajouter une tranche
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ces champs seront affichés sur la fiche (PDF) de la demande.
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
              Commentaire{commentaireRequired ? " *" : ""}
            </div>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
              required={commentaireRequired}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder={commentairePlaceholder}
            />
          </div>


          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              title="Annuler"
              aria-label="Annuler"
              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FiX />
            </button>

            <button
              type="submit"
              disabled={submitting}
              title={submitting ? "Traitement..." : mode === "approve" ? "Valider" : mode === "reject" ? "Rejeter" : "Retourner"}
              aria-label={submitting ? "Traitement..." : mode === "approve" ? "Valider" : mode === "reject" ? "Rejeter" : "Retourner"}
              className={`inline-flex items-center justify-center p-2 rounded-lg text-white hover:opacity-90 disabled:opacity-60 ${
                mode === "approve"
                  ? "bg-gray-900 dark:bg-white dark:text-gray-900"
                  : mode === "reject"
                    ? "bg-red-600"
                    : "bg-amber-600"
              }`}
            >
              {mode === "approve" ? <FiCheckCircle /> : mode === "reject" ? <FiXCircle /> : <FiCornerUpLeft />}
            </button>
          </div>
        </form>
        )}
    </Modal>

    <PdfPreviewModal
      open={pdfPreviewOpen}
      url={demande?.uuid ? `/demandes/${demande.uuid}/pdf` : ""}
      title={demande?.uuid ? `Fiche demande ${demande.uuid}` : "Fiche demande"}
      onClose={() => setPdfPreviewOpen(false)}
    />

    <BudgetLineQuickCreateModal
      open={budgetLineCreateOpen}
      form={budgetLineForm}
      setForm={setBudgetLineForm}
      saving={budgetLineCreateSaving}
      totalMontant={totalMontant}
      onClose={() => {
        if (budgetLineCreateSaving) return;
        setBudgetLineCreateOpen(false);
      }}
      onSave={saveBudgetLineFromValidation}
    />
    </>
  );
}

function BudgetLineQuickCreateModal({ open, form, setForm, saving, totalMontant, onClose, onSave }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Nouvelle ligne budgétaire"
      className="max-w-[760px] m-4"
    >
      <div className="no-scrollbar max-h-[calc(100vh-2rem)] overflow-y-auto p-4 pr-14 lg:p-6">
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
          Cette ligne sera creee au perimetre global entreprise et pourra etre selectionnee pour cette validation DAF.
          {totalMontant > 0 ? ` Montant de la demande: ${formatMoney(totalMontant)} FCFA.` : ""}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Code">
            <input
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Genere automatiquement si vide"
            />
          </Field>
          <Field label="Libelle *">
            <input
              value={form.libelle}
              onChange={(e) => setForm((p) => ({ ...p, libelle: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Ex: Materiel informatique"
            />
          </Field>
          <Field label="Exercice">
            <select
              value={form.exercice}
              onChange={(e) => setForm((p) => ({ ...p, exercice: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              {buildExerciceOptions(form.exercice).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mois">
            <select
              value={form.mois}
              onChange={(e) => setForm((p) => ({ ...p, mois: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              {BUDGET_MONTHS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Montant initial *">
            <input
              type="number"
              step="any"
              value={form.montant_initial}
              onChange={(e) => setForm((p) => ({ ...p, montant_initial: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="0"
            />
          </Field>
          <Field label="Devise">
            <input
              value={form.devise}
              onChange={(e) => setForm((p) => ({ ...p, devise: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </Field>
          <Field label="Controle">
            <select
              value={form.controle_mode}
              onChange={(e) => setForm((p) => ({ ...p, controle_mode: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="SOUPLE">Souple - avertissement seulement</option>
              <option value="STRICT">Strict - bloquant</option>
            </select>
          </Field>
          <Field label="Statut">
            <select
              value={form.statut}
              onChange={(e) => setForm((p) => ({ ...p, statut: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="active">Active</option>
              <option value="suspendue">Suspendue</option>
              <option value="cloturee">Cloturee</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg dark:border-gray-700"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !String(form.libelle || "").trim() || !String(form.montant_initial || "").trim()}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? "Enregistrement..." : "Créer et sélectionner"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={label}
            checked={value === "OUI"}
            onChange={() => onChange("OUI")}
          />
          Oui
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={label}
            checked={value === "NON"}
            onChange={() => onChange("NON")}
          />
          Non
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={label}
            checked={value === "NA"}
            onChange={() => onChange("NA")}
          />
          N/A
        </label>
      </div>
    </div>
  );
}

function DafSummaryItem({ label, value, comment = "" }) {
  return (
    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-gray-950/40">
      <div className="text-[11px] uppercase tracking-wide text-blue-700 dark:text-blue-200">{label}</div>
      <div className="mt-1 font-medium text-gray-900 dark:text-white/90">{value || "-"}</div>
      {comment ? <div className="mt-2 text-xs leading-snug text-gray-600 dark:text-gray-300">{comment}</div> : null}
    </div>
  );
}
