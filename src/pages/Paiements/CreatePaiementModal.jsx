import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { createPaiement, startPaiementSignature, completePaiementSignature } from "../../services/paiements.service";
import { listAllDemandes } from "../../services/demandes.services";
import { listBudgetLines } from "../../services/budgetLines.service";
import { Modal } from "../../components/ui/modal";
import { useAuth } from "../../context/AuthContext";
import { emitToast } from "../../services/toastBus";
import { formatMoney } from "../../utils/formatUtils";
import { budgetLineLabel, budgetLineOptionLabel, budgetWarningForAmount, formatBudgetWarning } from "../../utils/budgetLines";
import { uploadManyDocuments } from "../../services/documents.service";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import FirmaSignatureFrame from "../../components/common/FirmaSignatureFrame";
import { buildFileTooLargeMessage, splitFilesBySize } from "../../utils/uploadLimits";
import { FIRMA_ENABLED } from "../../utils/firma";

function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

function normalizeConditionSource(value) {
  if (!value) return "DEMANDEUR";
  const v = String(value).trim().toUpperCase();
  return v === "DAF" ? "DAF" : "DEMANDEUR";
}

const PAYABLE_STATUSES = new Set(["approuvee", "en_attente_paiement", "achat_effectue", "receptionnee"]);
const PAID_CONDITION_STATUSES = new Set(["paye", "payee", "regle", "reglee"]);

function isPayableStatus(statut) {
  return PAYABLE_STATUSES.has(String(statut || "").toLowerCase());
}

function normalizeConditionSourceForFilter(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "DAF") return "DAF";
  if (v === "DEMANDEUR") return "DEMANDEUR";
  return "";
}

function isConditionPaid(condition) {
  if (!condition) return false;
  if (condition.paiement_id) return true;
  const statusKey = String(condition.statut || "").toLowerCase();
  return PAID_CONDITION_STATUSES.has(statusKey);
}

function resolveEffectiveConditionSource(conditions = []) {
  const paid = (conditions || []).find((c) => isConditionPaid(c) && normalizeConditionSourceForFilter(c?.source));
  if (paid) return normalizeConditionSourceForFilter(paid?.source);
  if ((conditions || []).some((c) => normalizeConditionSourceForFilter(c?.source) === "DAF")) return "DAF";
  if ((conditions || []).some((c) => normalizeConditionSourceForFilter(c?.source) === "DEMANDEUR")) return "DEMANDEUR";
  return "";
}

function isFullyPaid(demande) {
  const all = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
  if (!all.length) return false;
  const effectiveSource = resolveEffectiveConditionSource(all);
  const scoped = effectiveSource
    ? all.filter((c) => normalizeConditionSourceForFilter(c?.source) === effectiveSource)
    : all;
  if (!scoped.length) return false;
  return scoped.every(isConditionPaid);
}

export default function CreatePaiementModal({ open, onClose, onCreated, defaultDemandeId = "" }) {
  const { hasAnyRole } = useAuth();
  const canChangeBudgetLine = hasAnyRole(["DAF", "ADMIN"]);
  const [form, setForm] = useState({
    demande_id: "",
    type_paiement: "total",
    montant: "",
    moyen_paiement: "",
    conditions_source: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [demandes, setDemandes] = useState([]);
  const [demandeResolved, setDemandeResolved] = useState(null);
  const autoMoyenRef = useRef("");
  const autoSourceRef = useRef("");
  const [uploadType, setUploadType] = useState("recu");
  const [uploadTypeAutre, setUploadTypeAutre] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [signatureUrl, setSignatureUrl] = useState("");
  const [signatureSessionId, setSignatureSessionId] = useState("");
  const [signatureRequestId, setSignatureRequestId] = useState("");
  const [signatureUserId, setSignatureUserId] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [signatureCompleting, setSignatureCompleting] = useState(false);
  const [budgetLines, setBudgetLines] = useState([]);
  const [budgetLinesLoading, setBudgetLinesLoading] = useState(false);
  const [ligneBudgetaireId, setLigneBudgetaireId] = useState("");
  const isSigning = FIRMA_ENABLED && Boolean(signatureUrl);

  const fetchDemandes = async () => {
    try {
      const res = await listAllDemandes({ statut: "approuvee,en_attente_paiement,achat_effectue,receptionnee" });
      if (res?.success) {
        const rows = (res.data || []).filter((d) => isPayableStatus(d?.statut) && !isFullyPaid(d));
        setDemandes(rows);
      } else {
        setDemandes([]);
      }
    } catch (e) {
      setDemandes([]);
      emitToast("Erreur chargement demandes", "error");
    }
  };

  const resolveDemande = async (id) => {
    if (!id) {
      setDemandeResolved(null);
      return;
    }
    const d = demandes.find((d) => Number(d.id) === Number(id));
    setDemandeResolved(d || null);
  };

  useEffect(() => {
    if (open) {
      fetchDemandes();
    }
  }, [open]);

  useEffect(() => {
    if (!open || !canChangeBudgetLine) return;
    let active = true;
    const load = async () => {
      setBudgetLinesLoading(true);
      try {
        const res = await listBudgetLines({ activeOnly: true });
        if (!active) return;
        setBudgetLines(res?.success && Array.isArray(res.data) ? res.data : []);
      } catch {
        if (active) setBudgetLines([]);
      } finally {
        if (active) setBudgetLinesLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [open, canChangeBudgetLine]);

  useEffect(() => {
    resolveDemande(form.demande_id);
  }, [form.demande_id, demandes]);

  useEffect(() => {
    if (!demandeResolved) {
      setLigneBudgetaireId("");
      return;
    }
    setLigneBudgetaireId(demandeResolved?.ligne_budgetaire_id ? String(demandeResolved.ligne_budgetaire_id) : "");
  }, [demandeResolved?.id, demandeResolved?.ligne_budgetaire_id]);

  useEffect(() => {
    if (!open) return;
    if (!defaultDemandeId) return;
    const nextId = String(defaultDemandeId);
    setForm((prev) => (String(prev.demande_id) === nextId ? prev : { ...prev, demande_id: nextId }));
  }, [open, defaultDemandeId]);

  const reset = () => {
    setForm({
      demande_id: "",
      type_paiement: "total",
      montant: "",
      moyen_paiement: "",
      conditions_source: "",
    });
    setError("");
    setSignatureError("");
    setLoading(false);
    setDemandeResolved(null);
    autoMoyenRef.current = "";
    autoSourceRef.current = "";
    setUploadType("recu");
    setUploadTypeAutre("");
    setUploadFiles([]);
    setSignatureUrl("");
    setSignatureSessionId("");
    setSignatureRequestId("");
    setSignatureUserId("");
    setSignatureError("");
    setSignatureCompleting(false);
    setBudgetLines([]);
    setBudgetLinesLoading(false);
    setLigneBudgetaireId("");
  };

  const close = () => {
    if (loading || signatureCompleting) return;
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setLoading(true);

      if (!form.demande_id) throw new Error("Sélectionnez une demande");
      if (!form.type_paiement) throw new Error("Sélectionnez un type de paiement");
      if (!form.montant) throw new Error("Entrez un montant");

      const m = Number(form.montant);
      if (!m || Number.isNaN(m) || m <= 0) throw new Error("Montant invalide");

      const hasUploads = uploadFiles.length > 0;
      const typeDoc =
        uploadType === "autre"
          ? `autre:${String(uploadTypeAutre || "").trim()}`
          : uploadType;
      if (hasUploads && uploadType === "autre" && (!uploadTypeAutre || !String(uploadTypeAutre).trim())) {
        throw new Error("Veuillez préciser le type (Autre)");
      }

      const payload = {
        demande_id: Number(form.demande_id),
        type_paiement: form.type_paiement,
        montant: Number(form.montant),
        moyen_paiement: form.moyen_paiement,
        conditions_source: conditionsSource,
      };
      if (canChangeBudgetLine && ligneBudgetaireId) {
        payload.ligne_budgetaire_id = Number(ligneBudgetaireId);
      }

      if (!FIRMA_ENABLED) {
        const res = await createPaiement(payload);
        if (!res?.success) throw new Error(res?.message || "Creation paiement impossible");

        const paiement = res?.data;
        if (hasUploads) {
          const paiementId = paiement?.id || paiement?.paiement?.id;
          if (!paiementId) throw new Error("Paiement cree, mais id introuvable pour upload");
          await uploadManyDocuments({
            files: uploadFiles,
            type_document: typeDoc,
            paiement_id: paiementId,
          });
        }

        emitToast("Paiement cree avec succes", "success");
        onCreated?.(paiement);
        close();
        return;
      }

      const res = await startPaiementSignature(payload);

      if (!res?.success) throw new Error(res?.message || "Signature impossible");

      const data = res?.data || {};
      const signingUrl = data.signingUrl || data.signing_url;
      if (!signingUrl) throw new Error("Lien de signature introuvable");
      setSignatureUrl(signingUrl);
      setSignatureSessionId(data.sessionId || data.session_id || "");
      setSignatureRequestId(data.signingRequestId || data.signing_request_id || "");
      setSignatureUserId(data.signingRequestUserId || data.signing_request_user_id || "");
      setSignatureError("");
      return;

    } catch (err) {
      setError(err?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const completeSignature = async () => {
    if (!signatureSessionId) return;
    if (signatureCompleting) return;
    setSignatureError("");

    try {
      setSignatureCompleting(true);
      const res = await completePaiementSignature(signatureSessionId);
      if (!res?.success) throw new Error(res?.message || "Signature non terminee");

      const paiement = res?.data;
      const hasUploads = uploadFiles.length > 0;
      const typeDoc =
        uploadType === "autre"
          ? `autre:${String(uploadTypeAutre || "").trim()}`
          : uploadType;

      if (hasUploads) {
        const paiementId = paiement?.id || paiement?.paiement?.id;
        if (!paiementId) throw new Error("Paiement cree, mais id introuvable pour upload");
        await uploadManyDocuments({
          files: uploadFiles,
          type_document: typeDoc,
          paiement_id: paiementId,
        });
      }

      emitToast("Paiement cree avec succes", "success");
      onCreated?.(paiement);
      close();
    } catch (err) {
      const msg = err?.message || "Erreur inconnue";
      setSignatureError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setSignatureCompleting(false);
    }
  };

  const handleUploadFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    const { accepted, rejected } = splitFilesBySize(files);
    if (rejected.length) {
      emitToast({
        variant: "error",
        title: "Fichier trop volumineux",
        message: buildFileTooLargeMessage(rejected),
        timeoutMs: 7000,
      });
    }
    setUploadFiles(accepted);
    if (!accepted.length) e.target.value = "";
  };

  // Calculer les montants en fonction de la demande sélectionnée
  const demandeMontant = useMemo(
    () => Number(demandeResolved?.montant_net ?? demandeResolved?.montant ?? 0),
    [demandeResolved?.montant_net, demandeResolved?.montant]
  );

  const availableSources = useMemo(() => {
    const sources = new Set(
      (demandeResolved?.conditions_paiement || []).map((c) => normalizeConditionSource(c?.source))
    );
    return Array.from(sources);
  }, [demandeResolved?.conditions_paiement]);

  const lockedSource = useMemo(() => {
    const list = demandeResolved?.conditions_paiement || [];
    const paid = list.find((c) => isConditionPaid(c));
    return paid ? normalizeConditionSource(paid?.source) : "";
  }, [demandeResolved?.conditions_paiement]);

  const conditionsSource = useMemo(
    () =>
      normalizeConditionSource(
        form.conditions_source || lockedSource || (availableSources.includes("DAF") ? "DAF" : "DEMANDEUR")
      ),
    [form.conditions_source, lockedSource, availableSources]
  );
  const hasDafConditions = availableSources.includes("DAF");

  const conditionsForSource = useMemo(() => {
    const all = demandeResolved?.conditions_paiement || [];
    return all.filter((c) => normalizeConditionSource(c?.source) === conditionsSource);
  }, [demandeResolved?.conditions_paiement, conditionsSource]);

  const isSourceLocked = Boolean(lockedSource);


  // Calculer les montants restants à payer pour les tranches
  const unpaid = useMemo(() => {
    if (!conditionsForSource?.length) return [];
    return (conditionsForSource || [])
      .filter((c) => !isConditionPaid(c)) // Non payees
      .map((c) => ({ ...c, montant_prevu: Number(c.montant_prevu) }))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // Tri par date
  }, [conditionsForSource]);

  const remainingTotal = useMemo(() => {
    return round2(unpaid.reduce((acc, c) => acc + Number(c?.montant_prevu || 0), 0));
  }, [unpaid]);

  const nextTranche = unpaid[0] || null;

  const isTotal = form.type_paiement === "total";
  const isPartiel = form.type_paiement === "partiel";

  // Auto-remplir le montant selon le type de paiement
  useEffect(() => {
    if (!open) return;
    if (!demandeResolved) {
      setForm((p) => ({ ...p, montant: "" }));
      return;
    }

    const expectedAmount = isTotal
      ? remainingTotal || demandeMontant
      : isPartiel
        ? nextTranche?.montant_prevu != null
          ? Number(nextTranche.montant_prevu)
          : null
        : null;

    if (expectedAmount != null) {
      // Auto-fill montant selon les règles (montant exact attendu)
      setForm((p) => ({ ...p, montant: String(expectedAmount) }));
    }
  }, [open, isTotal, isPartiel, remainingTotal, demandeMontant, nextTranche]);

  useEffect(() => {
    if (!demandeResolved) {
      autoMoyenRef.current = "";
      return;
    }
    const nextDefault = String(demandeResolved?.daf_critere4 || "").trim();
    if (!nextDefault) return;

    setForm((prev) => {
      const prevValue = String(prev.moyen_paiement || "");
      const shouldReplace = !prevValue || prevValue === autoMoyenRef.current;
      if (!shouldReplace) return prev;
      return { ...prev, moyen_paiement: nextDefault };
    });

    autoMoyenRef.current = nextDefault;
  }, [demandeResolved?.id, demandeResolved?.daf_critere4]);

  useEffect(() => {
    if (!demandeResolved) {
      autoSourceRef.current = "";
      return;
    }
    const sources = new Set(
      (demandeResolved?.conditions_paiement || []).map((c) => normalizeConditionSource(c?.source))
    );
    const nextDefault = lockedSource || (sources.has("DAF") ? "DAF" : "DEMANDEUR");

    setForm((prev) => {
      const prevValue = String(prev.conditions_source || "");
      const shouldReplace = !prevValue || prevValue === autoSourceRef.current;
      if (!shouldReplace) return prev;
      return { ...prev, conditions_source: nextDefault };
    });

    autoSourceRef.current = nextDefault;
  }, [demandeResolved?.id, demandeResolved?.conditions_paiement, lockedSource]);

  const validateMontant = () => {
    if (!demandeResolved) return null;
    if (!form.montant) return null;

    const m = Number(form.montant);
    if (!m || Number.isNaN(m) || m <= 0) return "Montant invalide";

    const expectedAmount = isTotal
      ? remainingTotal || demandeMontant
      : isPartiel
        ? nextTranche?.montant_prevu != null
          ? Number(nextTranche.montant_prevu)
          : null
        : null;

    if (expectedAmount != null && Math.abs(m - expectedAmount) > 0.01) {
      return `Montant attendu = ${expectedAmount}`;
    }
    return null;
  };

  const selectedBudgetLine = useMemo(() => {
    const selected = budgetLines.find((line) => Number(line.id) === Number(ligneBudgetaireId));
    if (selected) return selected;
    const assigned = demandeResolved?.lignes_budgetaires || null;
    if (assigned && Number(assigned.id) === Number(ligneBudgetaireId)) return assigned;
    return null;
  }, [budgetLines, ligneBudgetaireId, demandeResolved?.lignes_budgetaires]);

  const budgetWarning = useMemo(() => {
    return budgetWarningForAmount(selectedBudgetLine, Number(form.montant || 0));
  }, [selectedBudgetLine, form.montant]);

  const errorMsg = validateMontant();

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={close}
      showCloseButton={false}
      className={`w-full ${isSigning ? "max-w-4xl" : "max-w-2xl"} rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800`}
    >
      <FullscreenLoader show={loading || signatureCompleting} label={signatureCompleting ? "Signature..." : "Traitement..."} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Créer un paiement</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Remplissez les détails du paiement.</p>
        </div>

        <button
          type="button"
          disabled={loading || signatureCompleting}
          title="Fermer"
          aria-label="Fermer"
          className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={close}
        >
          <FiX />
        </button>
      </div>

      {signatureError ? (
        <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {signatureError}
        </div>
      ) : null}

      {error ? (
        <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {isSigning ? (
        <FirmaSignatureFrame
          signingUrl={signatureUrl}
          signatureRequestId={signatureRequestId}
          signatureUserId={signatureUserId}
          onCancel={close}
          onComplete={completeSignature}
          onError={setSignatureError}
          busy={signatureCompleting}
          title="Signer pour creer le paiement."
        />
      ) : (
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Demande</label>
          <select
            value={form.demande_id}
            onChange={(e) => setForm({ ...form, demande_id: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            disabled={loading}
          >
            <option value="">Sélectionnez une demande</option>
            {demandes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.motif} ({d.uuid}) - {formatMoney(d.montant_net ?? d.montant)} FCFA
                </option>
              ))}
          </select>
        </div>

        {demandeResolved ? (
          <div className="p-3 text-xs text-gray-600 bg-gray-50 rounded-lg dark:bg-gray-900 dark:text-gray-400">
            <div>Demande: {demandeResolved.motif}</div>
            <div>
              {" — "}Montant: {formatMoney(demandeMontant)} FCFA
            </div>
            {remainingTotal > 0 ? (
              <div>
                {" — "}Restant: <span className="font-medium">{formatMoney(remainingTotal)} FCFA</span>
              </div>
            ) : null}
            {nextTranche?.montant_prevu != null ? (
              <div>
                {" — "}Prochaine tranche: <span className="font-medium">{formatMoney(nextTranche.montant_prevu)} FCFA</span>
              </div>
            ) : null}
          </div>
        ) : null}

        {demandeResolved ? (
          <div className="p-3 border border-gray-200 rounded-xl dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Ligne budgétaire</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Ligne actuelle: {budgetLineLabel(demandeResolved?.lignes_budgetaires)}
            </div>
            {canChangeBudgetLine ? (
              <div className="mt-3">
                <select
                  value={ligneBudgetaireId}
                  onChange={(e) => setLigneBudgetaireId(e.target.value)}
                  disabled={loading || budgetLinesLoading}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                >
                  <option value="">{budgetLinesLoading ? "Chargement..." : "Selectionnez une ligne"}</option>
                  {budgetLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {budgetLineOptionLabel(line)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Le changement est reserve au DAF avant le premier paiement.
                </p>
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
                {formatBudgetWarning(selectedBudgetLine, Number(form.montant || 0))}
                {budgetWarning?.exceeded ? " Le dépassement est autorisé en mode souple." : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de paiement</label>
            <select
              value={form.type_paiement}
              onChange={(e) => setForm({ ...form, type_paiement: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              disabled={loading}
            >
              <option value="total">Total</option>
              <option value="partiel">Partiel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Montant</label>
            <input
              type="number"
              step="any"
              value={form.montant}
              onChange={(e) => setForm({ ...form, montant: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="0.00"
              disabled={loading || isTotal || isPartiel}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aperçu: {formatMoney(form.montant)} FCFA</p>
            {errorMsg ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{errorMsg}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Conditions</label>
            <select
              value={conditionsSource}
              onChange={(e) => setForm({ ...form, conditions_source: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              disabled={loading || !hasDafConditions || isSourceLocked}
            >
              <option value="DEMANDEUR">Demandeur</option>
              {hasDafConditions ? <option value="DAF">DAF</option> : null}
            </select>
            {isSourceLocked ? (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Source verrouillée par un paiement précédent ({lockedSource || "inconnue"}).
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Moyen de paiement</label>
            <select
              value={form.moyen_paiement}
              onChange={(e) => setForm({ ...form, moyen_paiement: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              disabled={loading}
            >
              <option value="">Sélectionnez un moyen</option>
              <option value="Virement">Virement</option>
              <option value="Chèque">Chèque</option>
              <option value="OM">OM</option>
              <option value="Espèces">Espèces</option>
              <option value="Cartes de recharges">Cartes de recharges</option>
            </select>
          </div>
        </div>

        <div className="p-3 border border-gray-200 rounded-xl dark:border-gray-800">
          <div className="text-sm font-medium text-gray-800 dark:text-white/90">Pièces jointes</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Type</div>
              <select
                value={uploadType}
                onChange={(e) => {
                  setUploadType(e.target.value);
                  if (e.target.value !== "autre") setUploadTypeAutre("");
                }}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                disabled={loading}
              >
                <option value="recu">Reçu</option>
                <option value="facture">Facture</option>
                <option value="preuve_paiement">Preuve de paiement</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            {uploadType === "autre" ? (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Préciser</div>
                <input
                  value={uploadTypeAutre}
                  onChange={(e) => setUploadTypeAutre(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  placeholder="Ex: Bordereau"
                  disabled={loading}
                />
              </div>
            ) : null}

            <div className={uploadType === "autre" ? "sm:col-span-1" : "sm:col-span-2"}>
              <div className="text-xs text-gray-500 dark:text-gray-400">Fichiers</div>
              <input
                type="file"
                multiple
                onChange={handleUploadFilesChange}
                className="w-full text-sm"
                disabled={loading}
              />
            </div>
          </div>
          {uploadFiles.length ? (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {uploadFiles.length} fichier(s) sélectionné(s)
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            title="Annuler"
            aria-label="Annuler"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FiX />
          </button>

          <button
            type="submit"
            disabled={loading}
            title={loading ? "Traitement..." : "Créer"}
            aria-label={loading ? "Traitement..." : "Créer"}
            className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            {loading ? <Loader inline size="sm" label="Traitement..." /> : <FiCheckCircle />}
          </button>
        </div>
      </form>
      )}
    </Modal>
  );
}
