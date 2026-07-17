import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  getDemande,
  deleteDemande,
  closeDemande,
  getDemandeValidationHistory,
  listAcheteurCandidates,
  assignDemandeAcheteur,
  confirmDemandeAchat,
  confirmDemandeAchatNotRequired,
} from "../../services/demandes.services";
import { listDocuments, uploadManyDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import { FiArrowLeft, FiCheckCircle, FiCornerUpLeft, FiDownload, FiEdit2, FiEye, FiFilePlus, FiLock, FiPlus, FiRefreshCw, FiUpload, FiXCircle } from "react-icons/fi";
import DemandeEditModal from "./DemandeEditModal";
import CreateReceptionModal from "../Receptions/CreateReceptionModal";
import ValidationActionModal from "../Validations/ValidationActionModal";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import LoadingButton from "../../components/common/LoadingButton";
import PdfPreviewModal from "../../components/common/PdfPreviewModal";
import { emitToast } from "../../services/toastBus";
import { downloadFile } from "../../utils/downloadFile";
import { labelDemandeStatut, labelValidationStepStatus, demandeStatusBadgeClass } from "../../utils/statusLabels";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { agentDisplayName, validationActorLabel, isDelegatedValidation } from "../../utils/validationActors";
import Loader from "../../components/common/Loader";
import { buildFileTooLargeMessage, splitFilesBySize } from "../../utils/uploadLimits";
import DocumentFileIcon from "../../components/common/DocumentFileIcon";
import { budgetLineLabel } from "../../utils/budgetLines";

const DAF_CRITERE4_LABEL = "Moyen de paiement";
const ACHETEUR_ALLOWED_UPLOAD_TYPES = new Set(["preuve_achat", "facture", "bon_livraison"]);
const MAX_ACHAT_FILES = 10;

function normalizeUploadType(value) {
  return String(value || "").trim().toLowerCase();
}

function isAcheteurAllowedUploadType(typeDocument) {
  const normalized = normalizeUploadType(typeDocument);
  return ACHETEUR_ALLOWED_UPLOAD_TYPES.has(normalized);
}

function buildAchatTypeDocument(type, autreValue = "") {
  const normalized = normalizeUploadType(type);
  if (normalized === "autre") {
    const details = String(autreValue || "").trim();
    return details ? `preuve_achat:${details}` : "";
  }
  return normalized;
}

function labelAchatType(typeDocument) {
  const normalized = normalizeUploadType(typeDocument);
  if (normalized === "preuve_achat") return "Preuve d'achat";
  if (normalized === "facture") return "Facture finale";
  if (normalized === "bon_livraison") return "Bon de livraison";
  if (normalized.startsWith("preuve_achat:")) {
    const details = String(typeDocument).slice("preuve_achat:".length).trim();
    return details ? `Autre (${details})` : "Autre";
  }
  return typeDocument || "-";
}

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

function normalizeConditionSource(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (v === "DAF") return "DAF";
  if (v === "DEMANDEUR") return "DEMANDEUR";
  return null;
}

function normalizeRoleName(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeValidationStopRole(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (["DAF", "DGA", "DG"].includes(v)) return v;
  return null;
}

function candidateScopesForDemande(demande) {
  const scopes = ["GLOBAL"];
  if (!demande) return scopes;
  if (demande.direction_id) scopes.push(`DIRECTION:${Number(demande.direction_id)}`);
  if (demande.departement_id) scopes.push(`DEPARTEMENT:${Number(demande.departement_id)}`);
  if (demande.service_id) scopes.push(`SERVICE:${Number(demande.service_id)}`);
  return scopes;
}

function filterValidationStepsByStopRole(steps, stopRole) {
  const list = Array.isArray(steps) ? steps : [];
  if (!stopRole || !list.length) return list;
  const stopLevels = list
    .filter((s) => normalizeRoleName(s?.role_name) === stopRole)
    .map((s) => Number(s?.level))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!stopLevels.length) return list;
  const stopLevel = Math.max(...stopLevels);
  return list.filter((s) => {
    const lvl = Number(s?.level);
    if (!Number.isFinite(lvl)) return true;
    return lvl <= stopLevel;
  });
}

export default function DemandeDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user, hasPermission, hasAnyPermission, refreshMe } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const canUpdateDemande = hasPermission("DEMANDE_UPDATE");
  const canCreateDemande = hasPermission("DEMANDE_CREATE");
  const canDeleteDemande = hasPermission("DEMANDE_DELETE");
  const canCloseDemande = hasPermission("DEMANDE_CLOSE");
  const canCreateReceptionPerm = hasPermission("RECEPTION_CREATE");
  const canAssignAcheteurPerm = hasPermission("DEMANDE_ASSIGN_ACHETEUR");
  const canViewPaiementDetails = hasPermission("PAIEMENT_GET");
  const canDownloadPdf = hasAnyPermission(["DEMANDE_PDF", "VALIDATION_LIST_PENDING", "VALIDATION_LIST_DONE"]);

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
  const [validationAction, setValidationAction] = useState({ open: false, mode: "approve" });
  const dgaRecapAutoOpenedRef = useRef("");

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState("devis_proforma");
  const [uploadTypeAutre, setUploadTypeAutre] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);
  const [achatSubmitting, setAchatSubmitting] = useState(false);
  const [achatDecisionSubmitting, setAchatDecisionSubmitting] = useState(false);
  const [achatDecisionCommentaire, setAchatDecisionCommentaire] = useState("");
  const [achatError, setAchatError] = useState("");
  const [achatType, setAchatType] = useState("preuve_achat");
  const [achatTypeAutre, setAchatTypeAutre] = useState("");
  const [achatCommentaire, setAchatCommentaire] = useState("");
  const [achatFiles, setAchatFiles] = useState([]);
  const [acheteurCandidates, setAcheteurCandidates] = useState([]);
  const [acheteurLoading, setAcheteurLoading] = useState(false);
  const [acheteurSaving, setAcheteurSaving] = useState(false);
  const [acheteurDraft, setAcheteurDraft] = useState("");
  const [acheteurError, setAcheteurError] = useState("");
  const [downloadState, setDownloadState] = useState({});
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const achatFilesInputRef = useRef(null);

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
    setPaiementsLoading(true);
    setError("");
    setPaiements([]);
    try {
      const res = await getDemande(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement demande");
      setDemande(res.data);
      setPaiements(Array.isArray(res?.data?.paiements) ? res.data.paiements : []);
      if (uuid) {
        await fetchValidationHistory(uuid);
      }
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
      setPaiements([]);
    } finally {
      setLoading(false);
      setPaiementsLoading(false);
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

  const loadAcheteurCandidates = async (idOrUuid) => {
    if (!idOrUuid) return;
    setAcheteurLoading(true);
    setAcheteurError("");
    try {
      const res = await listAcheteurCandidates(idOrUuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement acheteurs");
      setAcheteurCandidates(Array.isArray(res?.data?.acheteurs) ? res.data.acheteurs : []);
    } catch (e) {
      setAcheteurCandidates([]);
      setAcheteurError(e?.message || "Erreur chargement acheteurs");
    } finally {
      setAcheteurLoading(false);
    }
  };

  const saveAcheteurAssignment = async () => {
    if (!demande?.uuid || acheteurSaving) return;
    setAcheteurSaving(true);
    setAcheteurError("");
    try {
      const selectedAcheteurId = acheteurDraft ? Number(acheteurDraft) : null;
      const res = await assignDemandeAcheteur(demande.uuid, selectedAcheteurId);
      if (!res?.success) throw new Error(res?.message || "Affectation impossible");
      emitToast(selectedAcheteurId ? "Acheteur assigne" : "Acheteur retire", "success");
      await fetchDemande();
      if (canAssignAcheteur) await loadAcheteurCandidates(demande.uuid);
    } catch (e) {
      const msg = e?.message || "Erreur affectation acheteur";
      setAcheteurError(msg);
      emitToast(msg, "error");
    } finally {
      setAcheteurSaving(false);
    }
  };

  useEffect(() => {
    fetchDemande();
  }, [uuid]);

  useEffect(() => {
    if (demande?.id) {
      fetchDocs(demande.id);
    }
  }, [demande?.id]);

  useEffect(() => {
    setAcheteurDraft(demande?.acheteur_id != null ? String(demande.acheteur_id) : "");
  }, [demande?.acheteur_id]);

  const agentId = user?.agent?.id ?? user?.agent_id ?? user?.agentId;
  const isAdmin = roles.includes("ADMIN");
  const isOwner = useMemo(() => {
    if (!demande || !agentId) return false;
    return Number(demande.demandeur_id) === Number(agentId);
  }, [demande, agentId]);
  const assignedAcheteur = demande?.agents_demandes_paiement_acheteur_idToagents || null;
  const isAssignedAcheteur = useMemo(() => {
    if (!demande || !agentId || demande?.acheteur_id == null) return false;
    return Number(demande.acheteur_id) === Number(agentId);
  }, [demande, agentId]);

  const statutLower = useMemo(() => String(demande?.statut || "").toLowerCase(), [demande?.statut]);
  const isClosed = useMemo(() => ["cloture", "cloturee"].includes(statutLower), [statutLower]);
  const isRejected = useMemo(() => ["rejete", "rejetee"].includes(statutLower), [statutLower]);
  const returnWorkflow = demande?.return_workflow || null;
  const statutEligibleForReception = useMemo(
    () => ["approuvee", "en_attente_paiement", "paye", "payee", "achat_effectue"].includes(statutLower),
    [statutLower]
  );

  const validationStopRole = useMemo(
    () => normalizeValidationStopRole(demande?.validation_stop_role),
    [demande?.validation_stop_role]
  );
  const effectiveValidationSteps = useMemo(
    () => filterValidationStepsByStopRole(demande?.validation_steps, validationStopRole),
    [demande?.validation_steps, validationStopRole]
  );

  const hasValidationEngaged = useMemo(() => {
    const steps = effectiveValidationSteps || [];
    return steps.some((step) => {
      const st = String(step?.status || "").toLowerCase();
      return st && !["en_attente", "bloque"].includes(st);
    });
  }, [effectiveValidationSteps]);

  const allValidationsApproved = useMemo(() => {
    const steps = effectiveValidationSteps || [];
    if (!steps.length) return false;
    return steps.every((step) => String(step?.status || "").toLowerCase() === "valide");
  }, [effectiveValidationSteps]);

  const pendingValidationStep = useMemo(() => {
    const steps = (effectiveValidationSteps || []).filter(
      (s) => String(s?.status || "").toLowerCase() === "en_attente"
    );
    if (!steps.length) return null;
    const sorted = [...steps].sort((a, b) => (Number(a?.level) || 0) - (Number(b?.level) || 0));
    return sorted[0] || null;
  }, [effectiveValidationSteps]);

  const delegatedRoles = (user?.delegatedRoles || []).map((r) => String(r).toUpperCase());
  const canViewDafValidationFields =
    isAdmin ||
    roles.includes("DAF") ||
    delegatedRoles.includes("DAF") ||
    hasPermission("DEMANDE_DAF_FIELDS_VIEW");
  const pendingRole = String(pendingValidationStep?.role_name || "").toUpperCase();
  const canActByAssignment =
    pendingValidationStep?.validator_id != null &&
    agentId != null &&
    Number(pendingValidationStep.validator_id) === Number(agentId);
  const candidateScopes = useMemo(
    () => candidateScopesForDemande(demande),
    [demande?.direction_id, demande?.departement_id, demande?.service_id]
  );
  const isDelegatedDemandeur = useMemo(() => {
    if (!demande?.demandeur_id) return false;
    const delegations = user?.agent?.delegations || [];
    if (!delegations.length) return false;
    return delegations.some((d) => {
      if (Number(d?.principal_id) !== Number(demande.demandeur_id)) return false;
      const scope = d?.scope != null && String(d.scope).trim() !== "" ? String(d.scope).trim() : "GLOBAL";
      return scope.toUpperCase() === "GLOBAL" || candidateScopes.includes(scope);
    });
  }, [demande?.demandeur_id, user?.agent?.delegations, candidateScopes]);
  const canActByDelegation = useMemo(() => {
    if (!pendingValidationStep || !pendingRole) return false;
    const delegations = user?.agent?.delegations || [];
    if (delegations.length > 0) {
      const validatorId = pendingValidationStep?.validator_id != null ? Number(pendingValidationStep.validator_id) : null;
      return delegations.some((d) => {
        const roleName = normalizeRoleName(d?.role_name);
        if (!roleName || roleName !== pendingRole) return false;
        if (validatorId != null && Number(d?.principal_id) !== validatorId) return false;
        const scope = d?.scope != null && String(d.scope).trim() !== "" ? String(d.scope).trim() : null;
        if (scope && !candidateScopes.includes(scope)) return false;
        return true;
      });
    }
    return pendingRole && delegatedRoles.includes(pendingRole);
  }, [pendingValidationStep, pendingRole, user?.agent?.delegations, candidateScopes, delegatedRoles]);
  const canActOnPendingStep = !!pendingValidationStep && (canActByAssignment || canActByDelegation);
  const canApprovePending = canActOnPendingStep && hasPermission("VALIDATION_APPROVE");
  const canRejectPending = canActOnPendingStep && hasPermission("VALIDATION_REJECT");
  const canReturnPending = canActOnPendingStep && hasPermission("VALIDATION_RETURN_FOR_MODIFICATION");
  const showValidationActions = canApprovePending || canRejectPending || canReturnPending;
  const refreshTriedRef = useRef(false);
  useEffect(() => {
    if (!pendingValidationStep) return;
    if (canActOnPendingStep) return;
    if (refreshTriedRef.current) return;
    refreshTriedRef.current = true;
    refreshMe?.().catch(() => {});
  }, [pendingValidationStep, canActOnPendingStep, refreshMe]);
  const isDirectorPending = pendingRole === "DIRECTEUR";
  const canEditRole = ["DIRECTEUR", "DAF", "DGA", "DG"].includes(pendingRole);
  const isDirectorSameDirection =
    roles.includes("DIRECTEUR") &&
    demande?.direction_id != null &&
    user?.agent?.direction_id != null &&
    Number(demande.direction_id) === Number(user.agent.direction_id);
  const canEditAtPending =
    canUpdateDemande &&
    canEditRole &&
    !!pendingValidationStep &&
    (canActByAssignment || canActByDelegation || (isDirectorPending && isDirectorSameDirection));
  const canEdit = useMemo(() => {
    if (!demande || !user) return false;
    const isAModifier = String(demande.statut).toLowerCase() === "a_modifier";
    if (isAModifier && returnWorkflow?.active) return returnWorkflow.can_edit === true;
    const canRequestEdit = canUpdateDemande || canCreateDemande;
    if (!canRequestEdit) return false;
    if (isAModifier && (isOwner || isAdmin)) return true;
    if (isOwner && !hasValidationEngaged && !isClosed && !isRejected) return true;
    return canEditAtPending;
  }, [
    demande,
    user,
    isOwner,
    isAdmin,
    canUpdateDemande,
    canCreateDemande,
    hasValidationEngaged,
    isClosed,
    isRejected,
    canEditAtPending,
    returnWorkflow,
  ]);
  const validationActionItem = useMemo(() => {
    if (!pendingValidationStep || !demande) return null;
    return { ...pendingValidationStep, demandes_paiement: demande };
  }, [pendingValidationStep, demande]);

  useEffect(() => {
    if (!validationActionItem || !demande?.uuid || !pendingValidationStep?.id) return;
    if (pendingRole !== "DGA") return;
    if (!canApprovePending) return;
    if (validationAction.open) return;

    const key = `${demande.uuid}:${pendingValidationStep.id}`;
    if (dgaRecapAutoOpenedRef.current === key) return;
    dgaRecapAutoOpenedRef.current = key;
    setValidationAction({ open: true, mode: "approve" });
  }, [
    validationActionItem,
    demande?.uuid,
    pendingValidationStep?.id,
    pendingRole,
    canApprovePending,
    validationAction.open,
  ]);

  const openValidationAction = (mode) => {
    setValidationAction({ open: true, mode });
  };

  const closeValidationAction = () => {
    setValidationAction({ open: false, mode: "approve" });
  };

  const receptions = demande?.receptions || [];
  const hasReceptionBefore = useMemo(
    () => receptions.some((r) => String(r?.phase || "").toUpperCase() === "AVANT_PAIEMENT"),
    [receptions]
  );
  const hasReceptionAfter = useMemo(
    () => receptions.some((r) => String(r?.phase || "").toUpperCase() === "APRES_PAIEMENT"),
    [receptions]
  );
  const hasAnyPaiement = (demande?.paiements || []).length > 0;
  const achatAssignmentLocked = useMemo(
    () => ["achat_effectue", "receptionnee", "cloture", "cloturee"].includes(statutLower),
    [statutLower]
  );
  const canAssignAcheteur =
    canAssignAcheteurPerm &&
    !isClosed &&
    hasAnyPaiement &&
    demande?.achat_requis !== false &&
    !achatAssignmentLocked;
  const hasAchatMenuPermission = hasPermission("DEMANDE_LIST_ASSIGNED_ACHETEUR");
  const isSameDirectionAcheteur =
    user?.agent?.direction_id != null &&
    demande?.direction_id != null &&
    Number(user.agent.direction_id) === Number(demande.direction_id);
  const achatIsPending = ["en_attente_paiement", "paye", "payee"].includes(statutLower);
  const achatDecisionPending = demande?.achat_requis == null && statutLower !== "achat_effectue";
  const achatDecisionEligible =
    allValidationsApproved ||
    ["approuvee", "en_attente_paiement", "paye", "payee", "receptionnee"].includes(statutLower);
  const achatHandledByOther =
    hasAchatMenuPermission &&
    demande?.acheteur_id != null &&
    !isAssignedAcheteur &&
    statutLower === "achat_effectue";
  const canConfirmAchat =
    hasAchatMenuPermission &&
    isSameDirectionAcheteur &&
    achatIsPending &&
    demande?.achat_requis !== false &&
    (demande?.acheteur_id == null || isAssignedAcheteur) &&
    !isClosed &&
    !isRejected;
  const canDeclareNoAchat =
    achatDecisionPending &&
    achatDecisionEligible &&
    !isClosed &&
    !isRejected &&
    (isOwner || isAdmin || isDirectorSameDirection || (hasAchatMenuPermission && isSameDirectionAcheteur));

  const canCancelReturned =
    statutLower === "a_modifier" &&
    returnWorkflow?.active &&
    returnWorkflow.can_cancel === true;
  const canCancel =
    !isClosed &&
    !isRejected &&
    (canCancelReturned || (canDeleteDemande && (isOwner || isAdmin) && !hasValidationEngaged));
  const hasFinalReception = useMemo(
    () =>
      receptions.some(
        (r) => Boolean(r?.visa_directeur_id) && (r?.visa_daf_requis === false || Boolean(r?.visa_daf_id))
      ),
    [receptions]
  );
  const canClose = canCloseDemande && (isOwner || isAdmin) && !isClosed && hasFinalReception;
  const canCreateReception =
    canCreateReceptionPerm &&
    (isOwner || isDelegatedDemandeur || isAssignedAcheteur) &&
    achatDecisionEligible &&
    statutEligibleForReception &&
    !isClosed &&
    !isRejected &&
    !(hasReceptionBefore && hasReceptionAfter) &&
    !(hasAnyPaiement && hasReceptionAfter);
  const currentAcheteurId = demande?.acheteur_id != null ? String(demande.acheteur_id) : "";
  const hasAcheteurSelectionChanged = String(acheteurDraft || "") !== currentAcheteurId;
  const canSaveAcheteur = canAssignAcheteur && hasAcheteurSelectionChanged && !acheteurLoading && !acheteurSaving;

  useEffect(() => {
    if (canAssignAcheteur && demande?.uuid) {
      loadAcheteurCandidates(demande.uuid);
      return;
    }
    setAcheteurCandidates([]);
    setAcheteurError("");
  }, [canAssignAcheteur, demande?.uuid]);

  useEffect(() => {
    if (!isAssignedAcheteur) return;
    if (isAcheteurAllowedUploadType(uploadType)) return;
    setUploadType("preuve_achat");
    setUploadTypeAutre("");
  }, [isAssignedAcheteur, uploadType]);

  const handleAchatFilesChange = (e) => {
    const files = Array.from(e.target.files || []);
    const { accepted, rejected } = splitFilesBySize(files);
    const typeDocument = buildAchatTypeDocument(achatType, achatTypeAutre);
    if (!typeDocument) {
      emitToast({
        variant: "error",
        message: "Veuillez préciser le type de preuve (Autre) avant d'ajouter des fichiers.",
      });
      e.target.value = "";
      return;
    }
    if (rejected.length) {
      emitToast({
        variant: "error",
        title: "Fichier trop volumineux",
        message: buildFileTooLargeMessage(rejected),
        timeoutMs: 7000,
      });
    }
    setAchatFiles((prev) => {
      const map = new Map();
      const incoming = accepted.map((file) => ({ file, type_document: typeDocument }));
      for (const item of [...prev, ...incoming]) {
        const key = `${item?.file?.name || ""}_${item?.file?.size || 0}_${item?.file?.lastModified || 0}_${item?.type_document || ""}`;
        if (!map.has(key)) map.set(key, item);
      }
      const merged = Array.from(map.values());
      if (merged.length > MAX_ACHAT_FILES) {
        emitToast({
          variant: "warning",
          message: `Maximum ${MAX_ACHAT_FILES} pièces pour l'achat.`,
        });
        return merged.slice(0, MAX_ACHAT_FILES);
      }
      return merged;
    });
    e.target.value = "";
  };

  const openAchatFilesPicker = () => {
    if (achatSubmitting) return;
    achatFilesInputRef.current?.click();
  };

  const removeAchatFile = (index) => {
    setAchatFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const doConfirmAchat = async () => {
    if (!demande?.uuid || !canConfirmAchat) return;
    setAchatError("");
    try {
      if (!achatFiles.length) throw new Error("Veuillez joindre au moins une preuve d'achat");
      setAchatSubmitting(true);
      const res = await confirmDemandeAchat(demande.uuid, {
        files: achatFiles.map((item) => item.file),
        type_documents: achatFiles.map((item) => item.type_document),
        commentaire: achatCommentaire,
      });
      if (!res?.success) throw new Error(res?.message || "Confirmation achat impossible");
      setAchatFiles([]);
      if (achatFilesInputRef.current) achatFilesInputRef.current.value = "";
      setAchatCommentaire("");
      setAchatType("preuve_achat");
      setAchatTypeAutre("");
      emitToast("Achat confirmé avec succès", "success");
      await fetchDemande();
      if (demande?.id) await fetchDocs(demande.id);
    } catch (e) {
      const msg = e?.message || "Erreur confirmation achat";
      setAchatError(msg);
      emitToast(msg, "error");
    } finally {
      setAchatSubmitting(false);
    }
  };

  const doConfirmAchatNotRequired = async ({ closeAfter = false } = {}) => {
    if (!demande?.uuid || achatDecisionSubmitting) return;
    setAchatError("");
    setAchatDecisionSubmitting(true);
    try {
      const decisionRes = await confirmDemandeAchatNotRequired(demande.uuid, {
        commentaire: achatDecisionCommentaire,
      });
      if (!decisionRes?.success) {
        throw new Error(decisionRes?.message || "Confirmation impossible");
      }

      if (closeAfter) {
        const closeRes = await closeDemande(demande.uuid);
        if (!closeRes?.success) throw new Error(closeRes?.message || "Cloture echouee");
        emitToast("Aucun achat nécessaire confirmé. Demande clôturée.", "success");
      } else {
        emitToast("Aucun achat nécessaire confirmé.", "success");
      }

      setAchatDecisionCommentaire("");
      await fetchDemande();
    } catch (e) {
      const msg = e?.message || "Erreur de décision d'achat";
      setAchatError(msg);
      emitToast(msg, "error");
    } finally {
      setAchatDecisionSubmitting(false);
    }
  };

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

      if (isAssignedAcheteur && !isAcheteurAllowedUploadType(typeDoc)) {
        throw new Error("En tant qu'acheteur assigne, vous ne pouvez uploader que preuve_achat, facture ou bon_livraison.");
      }

      setUploading(true);
      await uploadManyDocuments({
        files: uploadFiles,
        type_document: typeDoc,
        demande_id: demande.id,
      });
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
    setConfirmAction({
      open: true,
      kind: achatDecisionPending ? "close_no_purchase" : "close",
    });
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
    if (confirmAction.kind === "no_purchase") {
      return {
        title: "Aucun achat nécessaire",
        message: "Veuillez confirmer que cette demande ne nécessite pas un achat.",
        confirmLabel: "Confirmer",
        variant: "warn",
        showComment: true,
      };
    }
    if (confirmAction.kind === "close_no_purchase") {
      return {
        title: "Confirmer puis clôturer",
        message:
          "Aucun achat n'a été enregistré. Veuillez confirmer que cette demande ne nécessite pas un achat avant la clôture.",
        confirmLabel: "Confirmer et clôturer",
        variant: "warn",
        showComment: true,
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
    try {
      if (kind === "cancel") {
        await handleCancelDemande();
      } else if (kind === "close") {
        await handleCloseDemande();
      } else if (kind === "no_purchase") {
        await doConfirmAchatNotRequired();
      } else if (kind === "close_no_purchase") {
        await doConfirmAchatNotRequired({ closeAfter: true });
      }
    } finally {
      setConfirmAction({ open: false, kind: null });
      setAchatDecisionCommentaire("");
    }
  };

  const paiementsTotal = useMemo(
    () => (paiements || []).reduce((acc, p) => acc + (Number(p.montant) || 0), 0),
    [paiements]
  );

  const conditionsBySource = useMemo(() => {
    const map = new Map();
    const all = demande?.conditions_paiement || [];
    for (const cond of all) {
      const source = normalizeConditionSource(cond?.source) || "DEMANDEUR";
      const list = map.get(source) || [];
      list.push(cond);
      map.set(source, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      map.set(key, list);
    }
    return map;
  }, [demande?.conditions_paiement]);

  const conditionsSourceFromPaiements = useMemo(() => {
    for (const p of paiements || []) {
      const src = normalizeConditionSource(p?.conditions_source);
      if (src) return src;
    }
    return null;
  }, [paiements]);

  const activeConditionsSource = useMemo(() => {
    if (conditionsSourceFromPaiements) return conditionsSourceFromPaiements;
    if ((conditionsBySource.get("DAF") || []).length) return "DAF";
    if ((conditionsBySource.get("DEMANDEUR") || []).length) return "DEMANDEUR";
    return null;
  }, [conditionsSourceFromPaiements, conditionsBySource]);

  const conditionsPaiement = useMemo(() => {
    if (!activeConditionsSource) return [];
    return conditionsBySource.get(activeConditionsSource) || [];
  }, [conditionsBySource, activeConditionsSource]);

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
  const createdByAgent = demande?.agents_demandes_paiement_created_by_idToagents;
  const showCreatedBy =
    createdByAgent &&
    demande?.created_by_id != null &&
    Number(demande.created_by_id) !== Number(demande.demandeur_id);
  const demandeurDirection = demande?.directions?.nom || demandeurAgent?.directions?.nom || "-";
  const demandeurDepartement = demande?.departements?.nom || demandeurAgent?.departements?.nom || "-";
  const demandeurService = demande?.services?.nom || demandeurAgent?.services?.nom || "-";

  return (
    <div className="space-y-4">
      <ValidationActionModal
        open={validationAction.open}
        mode={validationAction.mode}
        item={validationActionItem}
        onClose={closeValidationAction}
        onDone={async () => {
          closeValidationAction();
          await fetchDemande();
        }}
      />
      <PdfPreviewModal
        open={pdfPreviewOpen}
        url={demande?.uuid ? `/demandes/${demande.uuid}/pdf` : ""}
        title={demande?.uuid ? `Fiche demande ${demande.uuid}` : "Fiche demande"}
        onClose={() => setPdfPreviewOpen(false)}
      />
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
            loading={
              confirmAction.kind === "cancel"
                ? cancelLoading
                : ["no_purchase", "close_no_purchase"].includes(confirmAction.kind)
                  ? achatDecisionSubmitting
                  : closeLoading
            }
            showComment={!!confirmConfig.showComment}
            commentLabel="Commentaire (optionnel)"
            commentPlaceholder="Précisez pourquoi aucun achat n'est nécessaire"
            commentValue={achatDecisionCommentaire}
            onCommentChange={(e) => setAchatDecisionCommentaire(e.target.value)}
            onClose={() => {
              setConfirmAction({ open: false, kind: null });
              setAchatDecisionCommentaire("");
            }}
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
                <button
                  type="button"
                  onClick={() => setPdfPreviewOpen(true)}
                  title="Previsualiser PDF"
                  aria-label="Previsualiser PDF"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <FiEye />
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
                  label: "Description",
                  value: demande.description ? <span className="whitespace-pre-wrap">{demande.description}</span> : "-",
                },
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
                ...(showCreatedBy ? [{ label: "Saisi par", value: agentDisplayName(createdByAgent) }] : []),
                { label: "Acheteur assigne", value: assignedAcheteur ? agentDisplayName(assignedAcheteur) : "-" },
                { label: "Direction", value: demandeurDirection },
                { label: "Département", value: demandeurDepartement },
                { label: "Service", value: demandeurService },
                { label: "Montant brut", value: `${formatMoney(montantBrut)} FCFA` },
                { label: "Total net", value: `${formatMoney(montantNet)} FCFA` },
                { label: "Montant", value: `${formatMoney(montantNet)} FCFA` },
                { label: "Devise", value: demande.devise || "FCFA" },
                { label: "Bénéficiaire", value: demande.beneficiaire || "-" },
                { label: "Observations", value: demande.remarque || "-" },
                ...(canViewDafValidationFields
                  ? [
                      {
                        label: "Validé par OCI",
                        value:
                          demande.validation_oci === true ? "Oui" : demande.validation_oci === false ? "Non" : "-",
                      },
                      { label: "Paiement immédiat", value: demande.paiement_immediat ? "Oui" : "Non" },
                      { label: "Budget prévu", value: demande.budget_prevu ? "Oui" : "Non" },
                      { label: "Budget dispo", value: demande.budget_disponible ? "Oui" : "Non" },
                      { label: "Ligne budgetaire", value: budgetLineLabel(demande.lignes_budgetaires) },
                      {
                        label: "Depassement budgetaire",
                        value:
                          Number(demande.budget_depassement_montant || 0) > 0
                            ? `${formatMoney(demande.budget_depassement_montant)} FCFA`
                            : "-",
                      },
                    ]
                  : []),
                { label: dafCritere4Info.label, value: dafCritere4Info.value },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</dt>
                  <dd className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{item.value ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {canAssignAcheteur ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Affectation acheteur</div>
              {acheteurError ? (
                <div className="mt-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                  {acheteurError}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Acheteur de la direction</label>
                  <select
                    value={acheteurDraft}
                    onChange={(e) => setAcheteurDraft(e.target.value)}
                    disabled={acheteurLoading || acheteurSaving}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60"
                  >
                    <option value="">Aucun</option>
                    {acheteurCandidates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {`${a.prenom || ""} ${a.nom || ""}`.trim() || a.email || `Agent #${a.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-1 flex items-end justify-end">
                  <button
                    type="button"
                    onClick={saveAcheteurAssignment}
                    disabled={!canSaveAcheteur}
                    className={`inline-flex items-center justify-center p-2 rounded-lg ${
                      canSaveAcheteur
                        ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                        : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                    }`}
                    title={acheteurSaving ? "Enregistrement..." : "Enregistrer"}
                    aria-label={acheteurSaving ? "Enregistrement..." : "Enregistrer"}
                  >
                    {acheteurSaving ? <Loader inline size="sm" label="" /> : <FiCheckCircle />}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

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
          {effectiveValidationSteps && effectiveValidationSteps.length > 0 ? (
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
                    {[...effectiveValidationSteps]
                      .sort((a, b) => Number(a.level) - Number(b.level))
                      .map((step) => {
                        const actor = validationActorLabel(step);
                        const delegated = isDelegatedValidation(step);
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
                                {delegated ? (
                                  <div className="text-[11px] text-emerald-600 dark:text-emerald-300">Délégué</div>
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
              {activeConditionsSource ? (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Source: {activeConditionsSource === "DAF" ? "DAF" : "Demandeur"}
                </div>
              ) : null}
              
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
                          {canViewPaiementDetails ? (
                            <Link 
                              to={`/paiements/${p.uuid}`}
                              className="text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Voir
                            </Link>
                          ) : (
                            "-"
                          )}
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

          {(hasAchatMenuPermission && isSameDirectionAcheteur) || canDeclareNoAchat || demande?.achat_requis != null ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Décision d'achat</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {demande?.achat_requis === false
                  ? "Aucun achat nécessaire."
                  : demande?.achat_requis === true || statutLower === "achat_effectue"
                    ? "Achat effectué."
                    : "Décision en attente."}
              </div>
              {achatError ? (
                <div className="mt-2 px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                  {achatError}
                </div>
              ) : null}

              {canConfirmAchat ? (
                <>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Type de preuve</div>
                      <select
                        value={achatType}
                        onChange={(e) => {
                          setAchatType(e.target.value);
                          if (e.target.value !== "autre") setAchatTypeAutre("");
                        }}
                        disabled={achatSubmitting}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60"
                      >
                        <option value="preuve_achat">Preuve d'achat</option>
                        <option value="facture">Facture finale</option>
                        <option value="bon_livraison">Bon de livraison</option>
                        <option value="autre">Autre</option>
                      </select>
                      {achatType === "autre" ? (
                        <div className="mt-2">
                          <input
                            value={achatTypeAutre}
                            onChange={(e) => setAchatTypeAutre(e.target.value)}
                            disabled={achatSubmitting}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60"
                            placeholder="Préciser le type de preuve"
                          />
                        </div>
                      ) : null}
                    </div>
                    <div className="sm:col-span-2">
                      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Commentaire (optionnel)</div>
                      <input
                        value={achatCommentaire}
                        onChange={(e) => setAchatCommentaire(e.target.value)}
                        disabled={achatSubmitting}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60"
                        placeholder="Ex: achat validé, pièces jointes complètes"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Pièces justificatives ({achatFiles.length}/{MAX_ACHAT_FILES})</span>
                        <button
                          type="button"
                          onClick={openAchatFilesPicker}
                          disabled={achatSubmitting || achatFiles.length >= MAX_ACHAT_FILES}
                          title="Ajouter une preuve"
                          aria-label="Ajouter une preuve"
                          className={`inline-flex items-center justify-center p-1.5 rounded-lg border ${
                            achatSubmitting || achatFiles.length >= MAX_ACHAT_FILES
                              ? "border-gray-200 text-gray-400 cursor-not-allowed dark:border-gray-800 dark:text-gray-600"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
                          }`}
                        >
                          <FiPlus />
                        </button>
                      </div>
                      <input
                        ref={achatFilesInputRef}
                        type="file"
                        multiple
                        onChange={handleAchatFilesChange}
                        disabled={achatSubmitting}
                        className="hidden"
                      />
                      {achatFiles.length ? (
                        <div className="space-y-2">
                          {achatFiles.map((item, idx) => (
                            <div
                              key={`${item?.file?.name || "file"}_${item?.file?.size || 0}_${item?.file?.lastModified || idx}_${item?.type_document || ""}`}
                              className="flex items-center justify-between gap-2 px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-gray-700 dark:text-gray-200">
                                  {item?.file?.name || `Fichier ${idx + 1}`}
                                </div>
                                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                                  {labelAchatType(item?.type_document)}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAchatFile(idx)}
                                disabled={achatSubmitting}
                                title="Retirer"
                                aria-label="Retirer"
                                className="inline-flex items-center justify-center p-1 rounded text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-300 dark:hover:bg-red-500/10"
                              >
                                <FiXCircle />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-3 py-2 text-xs text-gray-500 border border-dashed border-gray-200 rounded-lg dark:border-gray-800 dark:text-gray-400">
                          Aucune pièce ajoutée.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    {canDeclareNoAchat ? (
                      <button
                        type="button"
                        disabled={achatSubmitting || achatDecisionSubmitting}
                        onClick={() => setConfirmAction({ open: true, kind: "no_purchase" })}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-500/10"
                      >
                        {achatDecisionSubmitting ? <Loader inline size="sm" label="" /> : <FiXCircle />}
                        Aucun achat nécessaire
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={achatSubmitting || achatDecisionSubmitting || !achatFiles.length}
                      onClick={doConfirmAchat}
                      title={achatSubmitting ? "Confirmation..." : "Confirmer achat"}
                      aria-label={achatSubmitting ? "Confirmation..." : "Confirmer achat"}
                      className={`inline-flex items-center justify-center p-2 rounded-lg ${
                        achatSubmitting || achatDecisionSubmitting || !achatFiles.length
                          ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                          : "bg-emerald-600 text-white hover:opacity-90"
                      }`}
                    >
                      {achatSubmitting ? <Loader inline size="sm" label="" /> : <FiCheckCircle />}
                    </button>
                  </div>
                </>
              ) : demande?.achat_requis === false ? (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                  Cette demande a été confirmée sans achat nécessaire
                  {demande?.achat_decision_commentaire
                    ? ` : ${demande.achat_decision_commentaire}`
                    : "."}
                </div>
              ) : achatHandledByOther ? (
                <div className="mt-3 text-sm text-amber-700 dark:text-amber-300">
                  Achat déjà confirmé par {agentDisplayName(assignedAcheteur)}. Vous ne pouvez plus agir sur cette demande.
                </div>
              ) : canDeclareNoAchat ? (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={achatDecisionSubmitting}
                    onClick={() => setConfirmAction({ open: true, kind: "no_purchase" })}
                    className="inline-flex items-center gap-2 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-500/10"
                  >
                    {achatDecisionSubmitting ? <Loader inline size="sm" label="" /> : <FiXCircle />}
                    Aucun achat nécessaire
                  </button>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  Cette demande n'est pas en attente d'achat.
                </div>
              )}
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
                    {isAssignedAcheteur ? (
                      <>
                        <option value="preuve_achat">Preuve d'achat</option>
                        <option value="facture">Facture finale</option>
                        <option value="bon_livraison">Bon de livraison</option>
                      </>
                    ) : (
                      <>
                        <option value="devis_proforma">Devis / Proforma</option>
                        <option value="facture_proforma">Facture proforma</option>
                        <option value="preuve_achat">Preuve d'achat</option>
                        <option value="facture">Facture finale</option>
                        <option value="bon_livraison">Bon de livraison</option>
                        <option value="contrat">Contrat</option>
                        <option value="autre">Autre</option>
                      </>
                    )}
                  </select>
                </div>

                {uploadType === "autre" && !isAssignedAcheteur ? (
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

                <div className={uploadType === "autre" && !isAssignedAcheteur ? "sm:col-span-1" : "sm:col-span-2"}>
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
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {documents.map((doc) => (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() =>
                      downloadFile(`/documents/${doc.id}/download`, doc.nom_fichier || `document_${doc.id}`, { mode: "preview" })
                    }
                    className="flex h-full w-full items-center gap-3 p-3 text-left text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                  >
                    <DocumentFileIcon fileName={doc.nom_fichier} format={doc.format} url={doc.url} />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{doc.type_document || "document"}</div>
                      <div className="truncate text-xs text-gray-500 dark:text-gray-400">{doc.nom_fichier}</div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.created_at)}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {showValidationActions ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Actions de validation</div>
              {pendingValidationStep ? (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Étape en attente: {pendingValidationStep.role_name || "-"} (niveau {pendingValidationStep.level ?? "-"})
                </div>
              ) : null}
              {canActByDelegation && !canActByAssignment ? (
                <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                  Vous agissez par délégation.
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {canApprovePending ? (
                  <button
                    type="button"
                    onClick={() => openValidationAction("approve")}
                    title="Valider"
                    aria-label="Valider"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                  >
                    <FiCheckCircle /> Valider
                  </button>
                ) : null}
                {canRejectPending ? (
                  <button
                    type="button"
                    onClick={() => openValidationAction("reject")}
                    title="Rejeter"
                    aria-label="Rejeter"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:opacity-90"
                  >
                    <FiXCircle /> Rejeter
                  </button>
                ) : null}
                {canReturnPending ? (
                  <button
                    type="button"
                    onClick={() => openValidationAction("return")}
                    title="Retourner"
                    aria-label="Retourner"
                    className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-amber-600 text-white hover:opacity-90"
                  >
                    <FiCornerUpLeft /> Retourner
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
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

