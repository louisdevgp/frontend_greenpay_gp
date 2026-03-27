import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { FiArrowLeft, FiCheckCircle, FiDownload, FiEye, FiRefreshCw, FiUpload, FiX } from "react-icons/fi";
import {
  getReception,
  visaDirecteur,
  visaDaf,
  startVisaDirecteurSignature,
  completeVisaDirecteurSignature,
  startVisaDafSignature,
  completeVisaDafSignature,
} from "../../services/receptions.service";
import { listDocuments, uploadManyDocuments } from "../../services/documents.service";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import Loader from "../../components/common/Loader";
import LoadingButton from "../../components/common/LoadingButton";
import { downloadFile } from "../../utils/downloadFile";
import { useAuth } from "../../context/AuthContext";
import { Modal } from "../../components/ui/modal";
import { formatMoney } from "../../utils/formatUtils";
import { emitToast } from "../../services/toastBus";
import { buildFileTooLargeMessage, splitFilesBySize } from "../../utils/uploadLimits";
import FirmaSignatureFrame from "../../components/common/FirmaSignatureFrame";
import { FIRMA_ENABLED } from "../../utils/firma";

function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

function mergeDateAndTime(dateOnly, timeSource) {
  if (!dateOnly) return timeSource || null;
  const d = dateOnly instanceof Date ? dateOnly : new Date(dateOnly);
  if (Number.isNaN(d.getTime())) return timeSource || null;
  const t = timeSource ? new Date(timeSource) : null;
  if (!t || Number.isNaN(t.getTime())) return d;
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    t.getHours(),
    t.getMinutes(),
    t.getSeconds(),
    t.getMilliseconds()
  );
}

function formatPhase(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "AVANT_PAIEMENT") return "Avant paiement";
  if (v === "APRES_PAIEMENT") return "Après paiement";
  return "-";
}


function normalizeRoleName(value) {
  return String(value || "").trim().toUpperCase();
}

function candidateScopesForDemande(demande) {
  const scopes = ["GLOBAL"];
  if (!demande) return scopes;
  if (demande.direction_id) scopes.push(`DIRECTION:${Number(demande.direction_id)}`);
  if (demande.departement_id) scopes.push(`DEPARTEMENT:${Number(demande.departement_id)}`);
  if (demande.service_id) scopes.push(`SERVICE:${Number(demande.service_id)}`);
  return scopes;
}

function hasDelegationForRole(delegations, roleName, candidateScopes = []) {
  const target = normalizeRoleName(roleName);
  if (!target) return false;
  const list = Array.isArray(delegations) ? delegations : [];
  if (!list.length) return false;
  const scopes = Array.isArray(candidateScopes) && candidateScopes.length ? candidateScopes : ["GLOBAL"];

  return list.some((d) => {
    const role = normalizeRoleName(d?.role_name);
    if (!role || role !== target) return false;
    const scopeRaw = d?.scope != null && String(d.scope).trim() !== "" ? String(d.scope).trim() : "GLOBAL";
    const scope = String(scopeRaw).toUpperCase();
    if (scope && scope !== "GLOBAL" && !scopes.includes(scope)) return false;
    return true;
  });
}

export default function ReceptionDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const delegations = user?.agent?.delegations || [];

  const canListReceptions = hasAnyPermission(["RECEPTION_LIST_SELF", "RECEPTION_LIST_ALL", "RECEPTION_LIST"]);
  const canViewDemandeDetails = hasAnyPermission([
    "DEMANDE_LIST",
    "DEMANDE_LIST_SELF",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
  ]);
  const canVisaDirecteurPerm = hasPermission("RECEPTION_VISA_DIRECTEUR");
  const canVisaDafPerm = hasPermission("RECEPTION_VISA_DAF");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reception, setReception] = useState(null);

  const hasAllVisas = !!reception?.visa_directeur_id && !!reception?.visa_daf_id;
  const canDownloadPdf = canListReceptions && hasAllVisas;

  const visaDirecteurAuto =
    !!reception?.visa_directeur_id &&
    !!reception?.conforme &&
    Number(reception?.visa_directeur_id) === Number(reception?.recu_par_id);
  const visaDirecteurDelegated = Boolean(reception?.visa_directeur_delegated);
  const visaDafDelegated = Boolean(reception?.visa_daf_delegated);
  const visaDirecteurValue = reception?.visa_directeur_id
    ? `Oui${reception.visa_directeur_nom ? ` (${reception.visa_directeur_nom})` : ""}${visaDirecteurAuto ? " (auto)" : ""}${visaDirecteurDelegated ? " (Délégué)" : ""}`
    : "Non";
  const visaDafValue = reception?.visa_daf_id
    ? `Oui${reception.visa_daf_nom ? ` (${reception.visa_daf_nom})` : ""}${visaDafDelegated ? " (Délégué)" : ""}`
    : "Non";

  const [docsLoading, setDocsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState("bl");
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

  const [visaLoading, setVisaLoading] = useState(false);
  const [visaError, setVisaError] = useState("");

  const [visaModalOpen, setVisaModalOpen] = useState(false);
  const [visaKind, setVisaKind] = useState(null); // "directeur" | "daf" | null
  // On n'utilise plus les signatures
  const [visaCommentaire, setVisaCommentaire] = useState("");
  const [visaModalError, setVisaModalError] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");
  const [signatureSessionId, setSignatureSessionId] = useState("");
  const [signatureRequestId, setSignatureRequestId] = useState("");
  const [signatureUserId, setSignatureUserId] = useState("");
  const [signatureCompleting, setSignatureCompleting] = useState(false);
  const isSigning = FIRMA_ENABLED && Boolean(signatureUrl);

  const fetchReception = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getReception(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement réception");
      setReception(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (receptionId) => {
    if (!receptionId) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments({ reception_id: receptionId });
      if (res?.success) setDocuments(res.data || []);
      else setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => { fetchReception(); }, [uuid]);
  useEffect(() => { if (reception?.id) fetchDocs(reception.id); }, [reception?.id]);

  const candidateScopes = useMemo(
    () => candidateScopesForDemande(reception?.demandes_paiement),
    [reception?.demandes_paiement?.direction_id, reception?.demandes_paiement?.departement_id, reception?.demandes_paiement?.service_id]
  );
  const directorByDelegation = useMemo(
    () => hasDelegationForRole(delegations, "DIRECTEUR", candidateScopes),
    [delegations, candidateScopes]
  );
  const demandeDirectionId = reception?.demandes_paiement?.direction_id ?? reception?.demandes_paiement?.directionId;
  const userDirectionId = user?.agent?.direction_id ?? user?.agent?.directionId;
  const isDirectorForDemandeDirection =
    roles.includes("DIRECTEUR") &&
    demandeDirectionId != null &&
    userDirectionId != null &&
    Number(demandeDirectionId) === Number(userDirectionId);
  const canVisaDirecteur =
    canVisaDirecteurPerm &&
    (roles.includes("ADMIN") || directorByDelegation || isDirectorForDemandeDirection) &&
    !reception?.visa_directeur_id;
  const canVisaDaf =
    canVisaDafPerm &&
    (roles.includes("DAF") || roles.includes("ADMIN")) &&
    !!reception?.visa_directeur_id &&
    !reception?.visa_daf_id;

  const startVisaSignature = async (kind, commentaire) => {
    if (!reception?.id) return;
    setVisaError("");
    try {
      setVisaLoading(true);
      const commentaireTrimmed = (commentaire || "").trim();
      const payload = commentaireTrimmed ? { commentaire: commentaireTrimmed } : {};

      if (!FIRMA_ENABLED) {
        const res = kind === "directeur" ? await visaDirecteur(reception.id, payload) : await visaDaf(reception.id, payload);
        if (!res?.success) throw new Error(res?.message || "Visa impossible");
        await fetchReception();
        emitToast({ variant: "success", message: kind === "daf" ? "Visa DAF effectue" : "Visa directeur effectue" });
        if (kind === "daf") {
          const targetUuid = res?.data?.uuid || reception?.uuid || uuid;
          if (targetUuid) {
            downloadFile(`/receptions/${targetUuid}/pdf`, `reception_${targetUuid}.pdf`);
          }
        }
        closeVisaModal();
        return;
      }

      const res =
        kind === "directeur"
          ? await startVisaDirecteurSignature(reception.id, payload)
          : await startVisaDafSignature(reception.id, payload);
      if (!res?.success) throw new Error(res?.message || "Signature impossible");
      const data = res?.data || {};
      const signingUrl = data.signingUrl || data.signing_url;
      if (!signingUrl) throw new Error("Lien de signature introuvable");
      setSignatureUrl(signingUrl);
      setSignatureSessionId(data.sessionId || data.session_id || "");
      setSignatureRequestId(data.signingRequestId || data.signing_request_id || "");
      setSignatureUserId(data.signingRequestUserId || data.signing_request_user_id || "");
      setVisaModalError("");
    } catch (e) {
      const msg = e?.message || "Erreur signature";
      setVisaModalError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setVisaLoading(false);
    }
  };

  const completeVisaSignature = async () => {
    if (!signatureSessionId || !visaKind) return;
    if (signatureCompleting) return;
    setVisaModalError("");
    try {
      setSignatureCompleting(true);
      const res =
        visaKind === "directeur"
          ? await completeVisaDirecteurSignature(reception.id, signatureSessionId)
          : await completeVisaDafSignature(reception.id, signatureSessionId);
      if (!res?.success) throw new Error(res?.message || "Signature non terminee");

      if (signatureSessionId) {
        const base = reception?.uuid || uuid || signatureSessionId;
        const filename = `signature_visa_${visaKind}_${base}.pdf`;
        void downloadFile(`/signatures/sessions/${signatureSessionId}/download`, filename).catch(() => {
          emitToast({ variant: "warning", message: "Preuve de signature indisponible." });
        });
      }

      await fetchReception();
      emitToast({ variant: "success", message: visaKind === "daf" ? "Visa DAF effectue" : "Visa directeur effectue" });
      if (visaKind === "daf") {
        const targetUuid = res?.data?.uuid || reception?.uuid || uuid;
        if (targetUuid) {
          downloadFile(`/receptions/${targetUuid}/pdf`, `reception_${targetUuid}.pdf`);
        }
      }
      closeVisaModal();
    } catch (e) {
      const msg = e?.message || "Erreur visa";
      setVisaModalError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setSignatureCompleting(false);
    }
  };

  const openVisaModal = (kind) => {
    setVisaModalError("");
    setVisaKind(kind);
    setVisaCommentaire("");
    setSignatureUrl("");
    setSignatureSessionId("");
    setSignatureRequestId("");
    setSignatureUserId("");
    setSignatureCompleting(false);
    setVisaModalOpen(true);
  };

  const closeVisaModal = () => {
    if (visaLoading || signatureCompleting) return;
    setVisaModalOpen(false);
    setVisaKind(null);
    setVisaCommentaire("");
    setVisaModalError("");
    setSignatureUrl("");
    setSignatureSessionId("");
    setSignatureRequestId("");
    setSignatureUserId("");
    setSignatureCompleting(false);
  };

  const confirmVisa = async () => {
    setVisaModalError("");
    try {
      if (!visaKind) throw new Error("Type de visa invalide");
      await startVisaSignature(visaKind, visaCommentaire);
    } catch (e) {
      setVisaModalError(e?.message || "Erreur visa");
    }
  };

  const doUpload = async () => {
    if (!reception?.id) return;
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
      const res = await uploadManyDocuments({
        files: uploadFiles,
        reception_id: reception.id,
        type_document: typeDoc,
      });
      if (!res?.success) throw new Error(res?.message || "Upload échoué");
      setUploadFiles([]);
      setUploadTypeAutre("");
      await fetchDocs(reception.id);
      emitToast({ variant: "success", message: "Documents uploades" });
    } catch (e) {
      const msg = e?.message || "Erreur upload";
      setUploadError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setUploading(false);
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

  return (
    <div className="space-y-4">
      <FullscreenLoader
        show={loading || visaLoading || signatureCompleting}
        label={signatureCompleting ? "Signature..." : visaLoading ? "Traitement..." : "Chargement de la réception..."}
      />

      <Modal
        isOpen={visaModalOpen}
        onClose={closeVisaModal}
        className={`${isSigning ? "max-w-4xl" : "max-w-2xl"} p-6`}
        showCloseButton={!visaLoading && !signatureCompleting}
      >
        <div className="text-lg font-semibold text-gray-800 dark:text-white/90">
          {visaKind === "directeur" ? "Visa Directeur" : visaKind === "daf" ? "Visa DAF" : "Visa"}
        </div>
        <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">Veuillez confirmer le visa.</div>

        {visaModalError ? (
          <div className="mt-3 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {visaModalError}
          </div>
        ) : null}

        {isSigning ? (
          <FirmaSignatureFrame
            signingUrl={signatureUrl}
            signatureRequestId={signatureRequestId}
            signatureUserId={signatureUserId}
            onCancel={closeVisaModal}
            onComplete={completeVisaSignature}
            onError={setVisaModalError}
            busy={signatureCompleting}
            title={visaKind === "daf" ? "Signer pour visa DAF." : "Signer pour visa Directeur."}
          />
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Commentaire (optionnel)</div>
              <textarea
                value={visaCommentaire}
                onChange={(e) => setVisaCommentaire(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                placeholder="Optionnel"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={visaLoading || signatureCompleting}
                onClick={closeVisaModal}
                title="Annuler"
                aria-label="Annuler"
                className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <FiX />
              </button>
              <button
                type="button"
                disabled={visaLoading || signatureCompleting}
                onClick={confirmVisa}
                title={visaLoading ? "Validation..." : "Valider"}
                aria-label={visaLoading ? "Validation..." : "Valider"}
                className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
              >
                <FiCheckCircle />
              </button>
            </div>
          </>
        )}
      </Modal>

      {error ? (
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
      ) : null}

      {!error && reception ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail réception</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{reception.uuid}</span>
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
              {canDownloadPdf ? (
                <>
                  <LoadingButton
                    type="button"
                    onClick={() =>
                      runDownload("reception-pdf", () =>
                        downloadFile(`/receptions/${reception.uuid || uuid}/pdf`, `reception_${reception.uuid || uuid}.pdf`)
                      )
                    }
                    loading={isDownloading("reception-pdf")}
                    title="Télécharger PDF"
                    aria-label="Télécharger PDF"
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    {isDownloading("reception-pdf") ? null : <FiDownload />}
                  </LoadingButton>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/receptions/${reception.uuid || uuid}/pdf`, `reception_${reception.uuid || uuid}.pdf`, {
                        mode: "preview",
                      })
                    }
                    title="Prévisualiser PDF"
                    aria-label="Prévisualiser PDF"
                    className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                  >
                    <FiEye />
                  </button>
                </>
              ) : null}
              <button
                onClick={fetchReception}
                disabled={loading}
                title="Rafraîchir"
                aria-label="Rafraîchir"
                className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
              >
                <FiRefreshCw />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info label="Receveur" value={reception.receveur_nom || "-"} />
            <Info
              label="Date réception"
              value={formatDateTime(mergeDateAndTime(reception.date_reception, reception.created_at))}
            />
            <Info label="Phase" value={formatPhase(reception.phase)} />
            <Info label="Créé" value={formatDateTime(reception.created_at)} />
            <Info label="Conforme" value={reception.conforme ? "Oui" : "Non"} />
            <Info label="Visa Directeur" value={visaDirecteurValue} />
            <Info label="Visa DAF" value={visaDafValue} />
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Description / observations</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{reception.description || "-"}</div>
            <div className="mt-3 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{reception.observations || "-"}</div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Visas</div>
              {visaLoading ? <span className="text-xs text-gray-500 dark:text-gray-400">Traitement...</span> : null}
            </div>

            {visaError ? (
              <div className="mt-3 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                {visaError}
              </div>
            ) : null}

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!canVisaDirecteur || visaLoading}
                onClick={() => openVisaModal("directeur")}
                title="Visa Directeur"
                aria-label="Visa Directeur"
                className={`inline-flex items-center justify-center p-2 rounded-lg ${
                  canVisaDirecteur
                    ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                <FiCheckCircle />
              </button>

              <button
                type="button"
                disabled={!canVisaDaf || visaLoading}
                onClick={() => openVisaModal("daf")}
                title="Visa DAF"
                aria-label="Visa DAF"
                className={`inline-flex items-center justify-center p-2 rounded-lg ${
                  canVisaDaf
                    ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                <FiCheckCircle />
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Demande liée</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              UUID: <span className="font-mono">{reception?.demandes_paiement?.uuid || "-"}</span>
            </div>

            {reception?.demandes_paiement?.uuid && canViewDemandeDetails ? (
              <div className="mt-3">
                <Link
                  to={`/demandes/${reception.demandes_paiement.uuid}`}
                  title="Voir demande"
                  aria-label="Voir demande"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <FiEye />
                </Link>
              </div>
            ) : null}
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents de réception</div>
              <button
                type="button"
                onClick={() => reception?.id && fetchDocs(reception.id)}
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
                    <option value="bl">BL</option>
                    <option value="facture_definitive">Facture définitive</option>
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
                      placeholder="Ex: bon de transport"
                    />
                  </div>
                ) : null}

                <div className={uploadType === "autre" ? "sm:col-span-1" : "sm:col-span-2"}>
                  <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Fichiers</div>
                  <input
                    type="file"
                    multiple
                    onChange={handleUploadFilesChange}
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





