import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getDemande, deleteDemande, closeDemande, getDemandeValidationHistory } from "../../services/demandes.services";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import { FiArrowLeft, FiDownload, FiEdit2, FiFilePlus, FiLock, FiRefreshCw, FiUpload, FiXCircle } from "react-icons/fi";
import DemandeEditModal from "./DemandeEditModal";
import CreateReceptionModal from "../Receptions/CreateReceptionModal";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import LoadingButton from "../../components/common/LoadingButton";
import { emitToast } from "../../services/toastBus";
import { downloadFile } from "../../utils/downloadFile";
import { labelDemandeStatut, labelValidationStepStatus, demandeStatusBadgeClass } from "../../utils/statusLabels";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { agentDisplayName, validationActorLabel } from "../../utils/validationActors";
import Loader from "../../components/common/Loader";

const DAF_CRITERE4_LABEL = "Moyen de paiement";

function parseBooleanLike(value) {
  if (value === true || value === false) return value;
  if (typeof value === "number") return value ? true : false;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    if (["true", "1", "oui", "yes"].includes(v)) return true;
    if (["false", "0", "non", "no"].includes(v)) return false;
  }
  return null;
}

function formatDafCritere4(value, fallbackLabel) {
  const boolLike = parseBooleanLike(value);
  if (boolLike === true) return { label: fallbackLabel, value: "Oui" };
  if (boolLike === false) return { label: fallbackLabel, value: "Non" };
  const str = value == null ? "" : String(value).trim();
  if (!str) return { label: fallbackLabel, value: "-" };
  return { label: fallbackLabel, value: str };
}

export default function DemandeDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demande, setDemande] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [paiements, setPaiements] = useState([]);
  const [paiementsLoading, setPaiementsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [validationHistory, setValidationHistory] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [receptionModalOpen, setReceptionModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [closeLoading, setCloseLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState({ open: false, kind: null });

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState("devis_proforma");
  const [uploadTypeAutre, setUploadTypeAutre] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [downloadState, setDownloadState] = useState({});

  const isDownloading = (key) => !!downloadState[key];
  const runDownload = async (key, fn) => {
    if (isDownloading(key)) return;
    setDownloadState((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } finally {
      setDownloadState((prev) => ({ ...prev, [key]: false }));
    }
  };

  const fetchDemande = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDemande(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement demande");
      setDemande(res.data);
      if (uuid) {
        await fetchValidationHistory(uuid);
      }
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchValidationHistory = async (demandeUuid) => {
    if (!demandeUuid) return;
    setHistoryLoading(true);
    setHistoryError("");
    try {
      const res = await getDemandeValidationHistory(demandeUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement historique");
      setValidationHistory(res.data || []);
    } catch (e) {
      setHistoryError(e?.message || "Erreur chargement historique");
      setValidationHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchDocs = async (demandeId) => {
    if (!demandeId) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments({ demande_id: demandeId });
      if (res?.success) setDocuments(res.data || []);
      else setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  const fetchPaiements = async (demandeId) => {
    if (!demandeId) return;
    setPaiementsLoading(true);
    try {
      const res = await fetch(`/api/paiements?demande_id=${demandeId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      const data = await res.json();
      if (data.success) setPaiements(data.data || []);
      else setPaiements([]);
    } catch (e) {
      setPaiements([]);
    } finally {
      setPaiementsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemande();
  }, [uuid]);

  useEffect(() => {
    if (demande?.id) {
      fetchDocs(demande.id);
      fetchPaiements(demande.id);
    }
  }, [demande?.id]);

  const agentId = user?.agent?.id ?? user?.agent_id ?? user?.agentId;
  const isAdmin = roles.includes("ADMIN");
  const isOwner = useMemo(() => {
    if (!demande || !agentId) return false;
    return Number(demande.demandeur_id) === Number(agentId);
  }, [demande, agentId]);

  const canEdit = useMemo(() => {
    if (!demande || !user) return false;
    const isAModifier = String(demande.statut).toLowerCase() === "a_modifier";
    return isAModifier && (isOwner || isAdmin);
  }, [demande, user, isOwner, isAdmin]);

  const statutLower = useMemo(() => String(demande?.statut || "").toLowerCase(), [demande?.statut]);
  const isClosed = useMemo(() => ["cloture", "cloturee"].includes(statutLower), [statutLower]);
  const isRejected = useMemo(() => ["rejete", "rejetee"].includes(statutLower), [statutLower]);
  const statutEligibleForReception = useMemo(
    () => ["approuvee", "en_attente_paiement", "paye", "payee"].includes(statutLower),
    [statutLower]
  );

  const hasValidationEngaged = useMemo(() => {
    const steps = demande?.validation_steps || [];
    return steps.some((step) => {
      const st = String(step?.status || "").toLowerCase();
      return st && !["en_attente", "bloque"].includes(st);
    });
  }, [demande?.validation_steps]);

  const allValidationsApproved = useMemo(() => {
    const steps = demande?.validation_steps || [];
    if (!steps.length) return false;
    return steps.every((step) => String(step?.status || "").toLowerCase() === "valide");
  }, [demande?.validation_steps]);

  const receptions = demande?.receptions || [];
  const hasReceptionBefore = useMemo(
    () => receptions.some((r) => String(r?.phase || "").toUpperCase() === "AVANT_PAIEMENT"),
    [receptions]
  );
  const hasReceptionAfter = useMemo(
    () => receptions.some((r) => String(r?.phase || "").toUpperCase() === "APRES_PAIEMENT"),
    [receptions]
  );
  const hasReception = receptions.length > 0;

  const canCancel = (isOwner || isAdmin) && !hasValidationEngaged && !isClosed && !isRejected;
  const canClose =
    (isOwner || isAdmin) &&
    !isClosed &&
    (hasReception || ["receptionnee", "paye", "payee"].includes(statutLower));
  const canCreateReception =
    isOwner &&
    allValidationsApproved &&
    statutEligibleForReception &&
    !isClosed &&
    !isRejected &&
    !(hasReceptionBefore && hasReceptionAfter);

  const canDownloadPdf = useMemo(() => {
    const allowedRoles = new Set(["ADMIN", "DAF", "DGA", "DG", "COMPTABLE", "DEMANDEUR"]);
    return roles.some((r) => allowedRoles.has(String(r).toUpperCase()));
  }, [roles]);

  const doUpload = async () => {
    if (!demande?.id) return;
    setUploadError("");
    try {
      if (!uploadFiles?.length) throw new Error("Veuillez choisir au moins un fichier");

      const typeDoc =
        uploadType === "autre"
          ? `autre:${String(uploadTypeAutre || "").trim()}`
          : uploadType;
      if (uploadType === "autre" && (!uploadTypeAutre || !String(uploadTypeAutre).trim())) {
        throw new Error("Veuillez préciser le type (Autre)");
      }

      setUploading(true);
      const formData = new FormData();
      for (const file of uploadFiles) {
        formData.append("files", file);
      }
      formData.append("demande_id", String(demande.id));
      formData.append("type_document", typeDoc);

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          // Note: Ne pas définir Content-Type, le navigateur le fait automatiquement avec le boundary pour FormData
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      const data = await res.json();
      if (!data.success) throw new Error(data?.message || "Upload échoué");
      setUploadFiles([]);
      setUploadTypeAutre("");
      await fetchDocs(demande.id); // Recharger les documents
      emitToast("Fichiers uploadés avec succès", "success");
    } catch (e) {
      setUploadError(e?.message || "Erreur upload");
      emitToast(e?.message || "Erreur upload", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelDemande = async () => {
    if (!demande?.uuid || cancelLoading) return;

    setCancelLoading(true);
    try {
      const res = await deleteDemande(demande.uuid);
      if (!res?.success) throw new Error(res?.message || "Annulation echouee");
      emitToast("Demande annulee", "success");
      nav(-1);
    } catch (e) {
      emitToast(e?.message || "Erreur annulation", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCloseDemande = async () => {
    if (!demande?.uuid || closeLoading) return;

    setCloseLoading(true);
    try {
      const res = await closeDemande(demande.uuid);
      if (!res?.success) throw new Error(res?.message || "Cloture echouee");
      emitToast("Demande cloturee", "success");
      await fetchDemande();
    } catch (e) {
      emitToast(e?.message || "Erreur cloture", "error");
    } finally {
      setCloseLoading(false);
    }
  };

  const requestCancelDemande = () => {
    setConfirmAction({ open: true, kind: "cancel" });
  };

  const requestCloseDemande = () => {
    setConfirmAction({ open: true, kind: "close" });
  };

  const confirmConfig = useMemo(() => {
    if (confirmAction.kind === "cancel") {
      return {
        title: "Annuler la demande",
        message: "Cette action est irreversible.",
        confirmLabel: "Annuler",
        variant: "danger",
      };
    }
    if (confirmAction.kind === "close") {
      return {
        title: "Cloturer la demande",
        message: "La demande sera cloturee.",
        confirmLabel: "Cloturer",
        variant: "warn",
      };
    }
    return {
      title: "Confirmation",
      message: "",
      confirmLabel: "Confirmer",
      variant: "primary",
    };
  }, [confirmAction.kind]);

  const handleConfirmAction = async () => {
    const kind = confirmAction.kind;
    setConfirmAction({ open: false, kind: null });
    if (kind === "cancel") {
      await handleCancelDemande();
    } else if (kind === "close") {
      await handleCloseDemande();
    }
  };

  const paiementsTotal = useMemo(
    () => (paiements || []).reduce((acc, p) => acc + (Number(p.montant) || 0), 0),
    [paiements]
  );

  const conditionsPaiement = useMemo(() => {
    if (!demande) return [];
    return [...(demande.conditions_paiement || [])].sort((a, b) =>
      new Date(a.created_at) - new Date(b.created_at)
    );
  }, [demande]);

  const timelineItems = useMemo(() => {
    const items = Array.isArray(validationHistory) ? [...validationHistory] : [];
    items.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return items;
  }, [validationHistory]);

  const timelineBadgeClass = (statusKey) => {
    const key = String(statusKey || "").toLowerCase();
    if (key === "valide") return { badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200", dot: "bg-green-500" };
    if (key === "rejete" || key === "rejetee") return { badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200", dot: "bg-red-500" };
    if (key === "retour_modification") return { badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200", dot: "bg-amber-500" };
    if (key === "annule" || key === "annulee") return { badge: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", dot: "bg-gray-400" };
    return { badge: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200", dot: "bg-gray-400" };
  };

  const itemsTotal = useMemo(() => {
    const items = demande?.demande_items || [];
    return items.reduce((acc, it) => {
      const q = Number(it?.quantite);
      const pu = Number(it?.prix_unitaire);
      if (Number.isFinite(q) && Number.isFinite(pu)) return acc + q * pu;
      const totalDirect = Number(it?.total_ligne);
      if (Number.isFinite(totalDirect)) return acc + totalDirect;
      return acc;
    }, 0);
  }, [demande?.demande_items]);

  const paiementsById = useMemo(() => {
    const map = new Map();
    for (const p of paiements) {
      if (p?.id != null) map.set(Number(p.id), p);
    }
    return map;
  }, [paiements]);

  const conditionIsPaid = (c) => {
    if (!c) return false;
    if (c.paiement_id) return true;
    const statut = String(c.statut || "").toLowerCase();
    return ["paye", "payee", "regle", "reglee"].includes(statut);
  };

  const hasConditionsPaiement = conditionsPaiement.length > 0;
  const allConditionsHavePaiement = hasConditionsPaiement
    ? conditionsPaiement.every((c) => conditionIsPaid(c))
    : false;
  const conditionLabelMap = useMemo(() => {
    if (!hasConditionsPaiement) return new Map();
    if (conditionsPaiement.length === 1) {
      return new Map([[conditionsPaiement[0]?.id, "Paiement total"]]);
    }
    const sortedByAmount = [...conditionsPaiement].sort(
      (a, b) => Number(b?.montant_prevu || 0) - Number(a?.montant_prevu || 0)
    );
    const highestId = sortedByAmount[0]?.id;
    const map = new Map();
    conditionsPaiement.forEach((c, idx) => {
      if (conditionsPaiement.length === 2 && highestId != null) {
        map.set(c.id, c.id === highestId ? "Acompte" : "Solde");
      } else {
        map.set(c.id, c.label || `Tranche ${idx + 1}`);
      }
    });
    return map;
  }, [conditionsPaiement, hasConditionsPaiement]);

  const paidAmountFromConditions = useMemo(() => {
    if (!hasConditionsPaiement) return 0;
    return conditionsPaiement.reduce((acc, c) => {
      if (!conditionIsPaid(c)) return acc;
      const montant = Number(c.montant_prevu);
      return acc + (Number.isFinite(montant) ? montant : 0);
    }, 0);
  }, [conditionsPaiement, hasConditionsPaiement]);

  const statutIndicatesPaid = useMemo(() => {
    const statut = String(demande?.statut || "").toLowerCase();
    return ["paye", "payee", "cloture", "cloturee"].includes(statut);
  }, [demande?.statut]);

  const paidAmountInfo = useMemo(() => {
    if (!demande) return 0;
    const totalNet = Number(demande.montant_net ?? demande.montant) || 0;
    if (paiementsTotal > 0) return { amount: paiementsTotal, source: "paiements" };
    if (paidAmountFromConditions > 0) return { amount: paidAmountFromConditions, source: "conditions" };
    if (statutIndicatesPaid && totalNet > 0) return { amount: totalNet, source: "statut" };
    return { amount: 0, source: "none" };
  }, [demande, paiementsTotal, paidAmountFromConditions, statutIndicatesPaid]);
  const paidAmountEffective = paidAmountInfo.amount;
  const isPaidAmountEstimated = paidAmountInfo.source !== "paiements" && paidAmountInfo.source !== "none";

  const paiementStatus = useMemo(() => {
    if (!demande) return { type: "none", label: "Non applicable" };
    const totalNet = Number(demande.montant_net ?? demande.montant) || 0;
    const hasPaiement = paidAmountEffective > 0;

    if (!hasPaiement) {
      return { type: "none", label: "Non payé" };
    }

    if (hasConditionsPaiement) {
      if (allConditionsHavePaiement || (totalNet > 0 && paidAmountEffective >= totalNet - 0.01)) {
        return { type: "total", label: "Payé (total)" };
      }
      return { type: "partial", label: "Payé (partiel)" };
    }

    // Ancien système sans conditions de paiement
    if (Math.abs(paidAmountEffective - totalNet) < 0.01) {
      return { type: "total", label: "Payé (total)" };
    }
    return { type: "partial", label: "Payé (partiel)" };
  }, [demande, paidAmountEffective, hasConditionsPaiement, allConditionsHavePaiement]);

  const montantBrut = useMemo(() => {
    if (!demande) return 0;
    const brut = Number(demande.montant);
    return Number.isFinite(brut) ? brut : 0;
  }, [demande]);

  const montantNet = useMemo(() => {
    if (!demande) return 0;
    const netRaw = demande.montant_net ?? demande.montant;
    const net = Number(netRaw);
    return Number.isFinite(net) ? net : 0;
  }, [demande]);

  const remiseType = useMemo(() => {
    return demande?.remise_type;
  }, [demande]);

  const remiseValeur = useMemo(() => {
    return demande?.remise_valeur;
  }, [demande]);

  const remiseMontant = useMemo(() => {
    if (!remiseType || remiseValeur == null) return 0;
    if (remiseType === "montant") return Number(remiseValeur);
    if (remiseType === "pourcentage") return montantBrut * (Number(remiseValeur) / 100);
    return 0;
  }, [remiseType, remiseValeur, montantBrut]);

  const dafCritere4Info = useMemo(
    () => formatDafCritere4(demande?.daf_critere4, DAF_CRITERE4_LABEL),
    [demande?.daf_critere4]
  );

  const demandeurAgent = demande?.agents_demandes_paiement_demandeur_idToagents;
  const demandeurDirection = demande?.directions?.nom || demandeurAgent?.directions?.nom || "-";
  const demandeurDepartement = demande?.departements?.nom || demandeurAgent?.departements?.nom || "-";
  const demandeurService = demande?.services?.nom || demandeurAgent?.services?.nom || "-";

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="p-4 text-center">Chargement...</div>
      ) : error ? (
        <div className="p-4 space-y-3">
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
          <button
            onClick={() => nav(-1)}
            title="Retour"
            aria-label="Retour"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
          >
            <FiArrowLeft />
          </button>
        </div>
      ) : demande ? (
        <>
          <DemandeEditModal
            open={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            demande={demande}
            onSaved={fetchDemande}
          />
          <CreateReceptionModal
            open={receptionModalOpen}
            demande={demande}
            onClose={() => setReceptionModalOpen(false)}
            onCreated={() => {
              setReceptionModalOpen(false);
              fetchDemande();
            }}
          />
          <ConfirmActionModal
            open={confirmAction.open}
            title={confirmConfig.title}
            message={confirmConfig.message}
            confirmLabel={confirmConfig.confirmLabel}
            confirmVariant={confirmConfig.variant}
            loading={confirmAction.kind === "cancel" ? cancelLoading : closeLoading}
            onClose={() => setConfirmAction({ open: false, kind: null })}
            onConfirm={handleConfirmAction}
          />

          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail demande</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{demande.uuid}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => nav(-1)}
                title="Retour"
                aria-label="Retour"
                className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
              >
                <FiArrowLeft />
              </button>
              {canEdit ? (
                <button
                  onClick={() => setEditModalOpen(true)}
                  title="Modifier"
                  aria-label="Modifier"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <FiEdit2 />
                </button>
              ) : null}
              {canCreateReception ? (
                <button
                  onClick={() => setReceptionModalOpen(true)}
                  disabled={loading}
                  title="Creer reception"
                  aria-label="Creer reception"
                  className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-60"
                >
                  <FiFilePlus />
                </button>
              ) : null}
              {canClose ? (
                <button
                  onClick={requestCloseDemande}
                  disabled={closeLoading}
                  title="Cloturer"
                  aria-label="Cloturer"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/20"
                >
                  <FiLock />
                </button>
              ) : null}
              {canCancel ? (
                <button
                  onClick={requestCancelDemande}
                  disabled={cancelLoading}
                  title="Annuler"
                  aria-label="Annuler"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-900/20"
                >
                  <FiXCircle />
                </button>
              ) : null}
              {canDownloadPdf ? (
                <LoadingButton
                  type="button"
                  onClick={() =>
                    runDownload("demande-pdf", () =>
                      downloadFile(`/demandes/${demande.uuid}/pdf`, `demande_${demande.uuid}.pdf`)
                    )
                  }
                  loading={isDownloading("demande-pdf")}
                  title="Télécharger PDF"
                  aria-label="Télécharger PDF"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  {isDownloading("demande-pdf") ? null : <FiDownload />}
                </LoadingButton>
              ) : null}
              <button
                onClick={fetchDemande}
                disabled={loading}
                title="Rafraîchir"
                aria-label="Rafraîchir"
                className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
              >
                <FiRefreshCw />
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Informations de la demande</div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                { label: "UUID", value: <span className="font-mono">{demande.uuid}</span> },
                { label: "Motif", value: demande.motif },
                {
                  label: "Statut",
                  value: (
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded ${demandeStatusBadgeClass(demande.statut)}`}>
                      {labelDemandeStatut(demande.statut)}
                    </span>
                  ),
                },
                { label: "Créé", value: formatDateTime(demande.created_at) },
                { label: "Mis à jour", value: formatDateTime(demande.updated_at) },
                { label: "Demandeur", value: agentDisplayName(demandeurAgent) },
                { label: "Direction", value: demandeurDirection },
                { label: "Département", value: demandeurDepartement },
                { label: "Service", value: demandeurService },
                { label: "Montant brut", value: `${formatMoney(montantBrut)} FCFA` },
                { label: "Total net", value: `${formatMoney(montantNet)} FCFA` },
                { label: "Montant", value: `${formatMoney(montantNet)} FCFA` },
                { label: "Devise", value: demande.devise || "FCFA" },
                { label: "Bénéficiaire", value: demande.beneficiaire || "-" },
                { label: "Observations", value: demande.remarque || "-" },
                { label: "Paiement immédiat", value: demande.paiement_immediat ? "Oui" : "Non" },
                { label: "Budget prévu", value: demande.budget_prevu ? "Oui" : "Non" },
                { label: "Budget dispo", value: demande.budget_disponible ? "Oui" : "Non" },
                { label: dafCritere4Info.label, value: dafCritere4Info.value },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</dt>
                  <dd className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{item.value ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Section Remise */}
          {remiseType && remiseValeur != null && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-950/30 dark:border-blue-900">
              <div className="text-sm font-medium text-blue-800 dark:text-blue-200">Détail de la remise</div>
              <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-3">
                <Info label="Type de remise" value={remiseType === "montant" ? "Montant fixe" : "Pourcentage"} />
                {remiseType === "pourcentage" ? (
                  <Info label="Taux de remise" value={`${formatMoney(remiseValeur)}%`} />
                ) : null}
                <Info label="Montant de remise" value={`${formatMoney(remiseMontant)} FCFA`} />
              </div>
            </div>
          )}

          {/* Section Paiement Status */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Statut de paiement</div>
              <span className={`px-2 py-1 text-xs rounded ${
                paiementStatus.type === "total" 
                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200" 
                  : paiementStatus.type === "partial" 
                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200" 
                    : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
              }`}>
                {paiementStatus.label}
              </span>
            </div>
            {paiementStatus.type !== "none" && (
              <div className="mt-2 text-sm">
                Montant payé: <span className="font-medium">{formatMoney(paidAmountEffective)} FCFA</span>
                {isPaidAmountEstimated && (
                  <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(montant estimé)</span>
                )}
                {paiementStatus.type === "partial" && (
                  <>
                    {" "}sur {formatMoney(montantNet)} FCFA
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section Validation Steps */}
          {demande.validation_steps && demande.validation_steps.length > 0 ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Parcours validations</div>
              
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Rôle</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Validé par</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Commentaire</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                    {[...demande.validation_steps]
                      .sort((a, b) => Number(a.level) - Number(b.level))
                      .map((step) => {
                        const actor = validationActorLabel(step);
                        return (
                          <tr key={step.id}>
                            <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{step.role_name}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`px-2 py-1 text-xs rounded ${
                                step.status === "valide"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                  : step.status === "en_attente"
                                    ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                                    : step.status === "rejete"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                                      : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                              }`}>
                                {labelValidationStepStatus(step.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              <div className="space-y-0.5">
                                <div>{actor?.primary || "-"}</div>
                                {actor?.secondary ? (
                                  <div className="text-xs text-gray-500 dark:text-gray-400">{actor.secondary}</div>
                                ) : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {step.validated_at ? formatDateTime(step.validated_at) : "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                              {step.commentaire || "-"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Section Historique validations */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Historique validations</div>
            {historyLoading ? (
              <div className="mt-3">
                <Loader label="Chargement de l'historique..." />
              </div>
            ) : historyError ? (
              <div className="mt-3 text-sm text-red-600 dark:text-red-300">{historyError}</div>
            ) : timelineItems.length === 0 ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun historique.</div>
            ) : (
              <div className="mt-4 relative border-l border-gray-200 dark:border-gray-800">
                {timelineItems.map((item, idx) => {
                  const badge = timelineBadgeClass(item.status);
                  const statusLabel = labelValidationStepStatus(item.status);
                  const roleLabel = item.role_name ? String(item.role_name) : "";
                  const key = item.audit_id ?? item.id ?? `${item.step_id || "step"}-${item.created_at || idx}`;
                  return (
                    <div key={key} className="relative pl-6 pb-6">
                      <span className={`absolute left-[-7px] top-1.5 h-3 w-3 rounded-full ${badge.dot}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs rounded ${badge.badge}`}>{statusLabel}</span>
                        {roleLabel ? (
                          <span className="text-xs text-gray-500 dark:text-gray-400">{roleLabel}</span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(item.created_at)}
                        {item.actor_name ? ` • ${item.actor_name}` : ""}
                      </div>
                      {item.commentaire ? (
                        <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">{item.commentaire}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section Conditions de paiement */}
          {hasConditionsPaiement ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Conditions de paiement</div>
              
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Libellé</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant prévu</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Statut</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant payé</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                    {conditionsPaiement.map((cond, index) => {
                        const paiement = cond.paiement_id ? paiementsById.get(Number(cond.paiement_id)) : null;
                        const isPaye = conditionIsPaid(cond);
                        const baseLabel = conditionLabelMap.get(cond.id) || cond.label || `Tranche ${index + 1}`;
                        const pourcentageLabel =
                          cond.pourcentage != null && String(cond.pourcentage).trim() !== ""
                            ? `${formatMoney(cond.pourcentage)}%`
                            : "";
                        const fullLabel = pourcentageLabel ? `${baseLabel} ${pourcentageLabel}` : baseLabel;

                      return (
                        <tr key={cond.id}>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                            {fullLabel}
                            {cond.condition_texte ? ` - ${cond.condition_texte}` : ""}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                            {formatMoney(cond.montant_prevu)} FCFA
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs rounded ${
                              isPaye
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            }`}>
                              {isPaye ? "Payé" : "Prévu"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                            {paiement?.montant != null
                              ? `${formatMoney(paiement.montant)} FCFA`
                              : isPaye && cond.montant_prevu != null
                                ? `${formatMoney(cond.montant_prevu)} FCFA`
                                : "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {/* Section Paiements */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Paiements</div>
            
            {paiementsLoading ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement...</div>
            ) : paiements.length === 0 ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun paiement enregistré.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Créé</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Lien</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                    {paiements.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{p.uuid}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{formatMoney(p.montant)} FCFA</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(p.created_at)}</td>
                        <td className="px-4 py-3 text-sm">
                          <Link 
                            to={`/paiements/${p.uuid}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Voir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section Items */}
          {demande.demande_items && demande.demande_items.length > 0 ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Items de la demande</div>
              
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Désignation</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Quantité</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Unité</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">PU</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                    {demande.demande_items.map((it) => {
                      const q = Number(it?.quantite);
                      const pu = Number(it?.prix_unitaire);
                      const lineTotal = Number.isFinite(q) && Number.isFinite(pu)
                        ? q * pu
                        : Number(it?.total_ligne);

                      return (
                      <tr key={it.id}>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90 max-w-xs">{it.designation}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{it.quantite}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{it.unite || "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                          {it.prix_unitaire != null ? `${formatMoney(it.prix_unitaire)} FCFA` : "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">
                          {Number.isFinite(lineTotal) ? `${formatMoney(lineTotal)} FCFA` : "-"}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200" colSpan={4}>
                        Total des items
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                        {formatMoney(itemsTotal)} FCFA
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : null}

          {/* Section Documents */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents joints</div>
              <button
                type="button"
                onClick={() => demande?.id && fetchDocs(demande.id)}
                disabled={docsLoading}
                title={docsLoading ? "Traitement..." : "Recharger"}
                aria-label={docsLoading ? "Traitement..." : "Recharger"}
                className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60"
              >
                {docsLoading ? <Loader inline size="sm" label="" /> : <FiRefreshCw />}
              </button>
            </div>

            <div className="mt-3 p-3 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Ajouter des pièces</div>
              {uploadError ? (
                <div className="mt-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                  {uploadError}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Type</div>
                  <select
                    value={uploadType}
                    onChange={(e) => {
                      setUploadType(e.target.value);
                      if (e.target.value !== "autre") setUploadTypeAutre("");
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="devis_proforma">Devis / Proforma</option>
                    <option value="facture_proforma">Facture proforma</option>
                    <option value="contrat">Contrat</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                {uploadType === "autre" ? (
                  <div>
                    <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Préciser</div>
                    <input
                      value={uploadTypeAutre}
                      onChange={(e) => setUploadTypeAutre(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                      placeholder="Ex: Cahier des charges"
                    />
                  </div>
                ) : null}

                <div className={uploadType === "autre" ? "sm:col-span-1" : "sm:col-span-2"}>
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Fichiers</div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                    className="w-full text-sm"
                  />
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={uploading || !uploadFiles.length}
                  onClick={doUpload}
                  title={uploading ? "Upload..." : "Uploader"}
                  aria-label={uploading ? "Upload..." : "Uploader"}
                  className={`inline-flex items-center justify-center p-2 rounded-lg ${
                    uploading || !uploadFiles.length
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                      : "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                  }`}
                >
                  <FiUpload />
                </button>
              </div>
            </div>

            {docsLoading ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement documents...</div>
            ) : documents.length === 0 ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun document.</div>
            ) : (
              <div className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() =>
                      downloadFile(`/documents/${doc.id}/download`, doc.nom_fichier || `document_${doc.id}`, { mode: "preview" })
                    }
                    className="flex items-center justify-between p-3 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                  >
                    <div>
                      <div className="font-medium">{doc.type_document || "document"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{doc.nom_fichier}</div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.created_at)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{value}</div>
    </div>
  );
}

