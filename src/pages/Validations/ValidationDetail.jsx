import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { FiArrowLeft, FiEye, FiRefreshCw } from "react-icons/fi";
import { getValidationByUuid } from "../../services/validations.service";
import { listDocuments } from "../../services/documents.service";
import LoadingButton from "../../components/common/LoadingButton";
import DocumentFileIcon from "../../components/common/DocumentFileIcon";
import { labelDemandeStatut, demandeStatusBadgeClass } from "../../utils/statusLabels";
import { downloadFile } from "../../utils/downloadFile";
import { useAuth } from "../../context/AuthContext";
import { agentDisplayName, validationActorLabel, isDelegatedValidation } from "../../utils/validationActors";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { budgetLineLabel } from "../../utils/budgetLines";

function pickDemande(v) {
  return v?.demande || v?.demandes_paiement || v?.demande_paiement || null;
}

function ActorLabel({ validation }) {
  const actor = validationActorLabel(validation);
  const primary = actor?.primary || "-";
  const secondary = actor?.secondary;
  const delegated = isDelegatedValidation(validation);

  return (
    <div>
      <div>{primary}</div>
      {secondary ? <div className="text-xs text-gray-500 dark:text-gray-400">{secondary}</div> : null}
      {delegated ? <div className="text-[11px] text-emerald-600 dark:text-emerald-300">Délégué</div> : null}
    </div>
  );
}

export default function ValidationDetail() {
  const { uuid } = useParams(); // âœ… uuid
  const nav = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
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

  const fetchValidation = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getValidationByUuid(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement validation");
      setValidation(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
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

  useEffect(() => {
    fetchValidation();
  }, [uuid]);

  useEffect(() => {
    if (validation?.demandes_paiement?.id) {
      fetchDocs(validation.demandes_paiement.id);
    }
  }, [validation?.demandes_paiement?.id]);

  const demande = useMemo(() => pickDemande(validation), [validation]);

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
      ) : validation ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail validation</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{validation.uuid}</span>
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
              <button
                onClick={fetchValidation}
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
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Informations de validation</div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {[
                { label: "UUID", value: <span className="font-mono">{validation.uuid}</span> },
                { label: "Rôle", value: validation.role_name || "-" },
                { label: "Statut", value: labelValidationStepStatus(validation.status) },
                { label: "Créé", value: formatDateTime(validation.created_at) },
                { label: "Validé", value: validation.validated_at ? formatDateTime(validation.validated_at) : "-" },
                { label: "Validé par", value: <ActorLabel validation={validation} /> },
                { label: "Niveau", value: validation.level },
                { label: "Commentaire", value: validation.commentaire || "-" },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</dt>
                  <dd className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{item.value ?? "-"}</dd>
                </div>
              ))}
            </dl>
          </div>

          {demande ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-800 dark:text-white/90">Demande liée</div>
                <Link
                  to={`/demandes/${demande.uuid}`}
                  title="Voir demande"
                  aria-label="Voir demande"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <FiEye />
                </Link>
              </div>
              <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {[
                  { label: "UUID", value: <span className="font-mono">{demande.uuid}</span> },
                  { label: "Motif", value: demande.motif || "-" },
                  { label: "Montant", value: `${formatMoney(demande.montant_net ?? demande.montant)} FCFA` },
                  { label: "Ligne budgetaire", value: budgetLineLabel(demande.lignes_budgetaires) },
                  {
                    label: "Statut",
                    value: (
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded ${demandeStatusBadgeClass(demande.statut)}`}>
                        {labelDemandeStatut(demande.statut)}
                      </span>
                    ),
                  },
                  { label: "Créé", value: formatDateTime(demande.created_at) },
                  { label: "Demandeur", value: agentDisplayName(demande.agents_demandes_paiement_demandeur_idToagents) },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{item.label}</dt>
                    <dd className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{item.value ?? "-"}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents liés</div>
            <div className="mt-2">
              {docsLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Chargement...</div>
              ) : documents.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Aucun document.</div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {documents.map((doc) => {
                    const downloadKey = `doc-${doc.id}`;
                    return (
                      <LoadingButton
                        key={doc.id}
                        type="button"
                        onClick={() =>
                          runDownload(downloadKey, () =>
                            downloadFile(`/documents/${doc.id}/download`, doc.nom_fichier || `document_${doc.id}`)
                          )
                        }
                        loading={isDownloading(downloadKey)}
                        title="Télécharger"
                        aria-label="Télécharger"
                        className="flex h-full w-full items-center gap-3 p-3 text-left text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                      >
                        <DocumentFileIcon fileName={doc.nom_fichier} format={doc.format} url={doc.url} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{doc.type_document || "document"}</div>
                          <div className="truncate text-xs text-gray-500 dark:text-gray-400">{doc.nom_fichier}</div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.created_at)}</div>
                        </div>
                      </LoadingButton>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function labelValidationStepStatus(status) {
  const labels = {
    en_attente: "En attente",
    bloque: "Bloqué",
    valide: "Validé",
    rejete: "Rejeté",
    retour_modification: "Retour pour modification",
  };
  return labels[status] || status;
}
