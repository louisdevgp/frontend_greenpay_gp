import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiDownload, FiRefreshCw } from "react-icons/fi";
import { getPaiement } from "../../services/paiements.service";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import LoadingButton from "../../components/common/LoadingButton";
import DocumentFileIcon from "../../components/common/DocumentFileIcon";
import { downloadFile } from "../../utils/downloadFile";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { budgetLineLabel } from "../../utils/budgetLines";

export default function PaiementDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { hasAnyPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paiement, setPaiement] = useState(null);
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

  const fetchPaiement = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPaiement(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement paiement");
      setPaiement(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (paiementId) => {
    if (!paiementId) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments({ paiement_id: paiementId });
      if (res?.success) setDocuments(res.data || []);
      else setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchPaiement();
  }, [uuid]);

  useEffect(() => {
    if (paiement?.id) {
      fetchDocs(paiement.id);
    }
  }, [paiement?.id]);

  const canDownloadDemandePdf = hasAnyPermission([
    "DEMANDE_PDF",
    "DEMANDE_LIST_ASSIGNED_ACHETEUR",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
    "PAIEMENT_GET",
  ]);
  const canViewDemandeDetails = hasAnyPermission([
    "DEMANDE_LIST",
    "DEMANDE_LIST_SELF",
    "DEMANDE_LIST_ASSIGNED_ACHETEUR",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
  ]);
  const comptableName = `${paiement?.agents?.users?.prenom || ""} ${paiement?.agents?.users?.nom || ""}`.trim();
  const comptableFallback = String(paiement?.comptable_nom || "").trim();
  const comptableFallbackIsEmail = comptableFallback.includes("@");
  const comptableBaseLabel =
    comptableName || (comptableFallback && !comptableFallbackIsEmail ? comptableFallback : "");
  const comptableLabel = comptableBaseLabel
    ? `${comptableBaseLabel}${paiement.paiement_delegated ? " (Délégué)" : ""}`
    : "-";
  const beneficiaireLabel = paiement?.beneficiaire || paiement?.demandes_paiement?.beneficiaire || "-";
  const demandeUuid = paiement?.demandes_paiement?.uuid || null;

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
      ) : paiement ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail paiement</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{paiement.uuid}</span>
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
              {demandeUuid && canDownloadDemandePdf ? (
                <LoadingButton
                  type="button"
                  onClick={() =>
                    runDownload("demande-pdf", () =>
                      downloadFile(`/demandes/${demandeUuid}/pdf`, `demande_${demandeUuid}.pdf`)
                    )
                  }
                  loading={isDownloading("demande-pdf")}
                  title="Télécharger fiche demande"
                  aria-label="Télécharger fiche demande"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  {isDownloading("demande-pdf") ? null : <FiDownload />}
                </LoadingButton>
              ) : null}
              <button
                onClick={fetchPaiement}
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
            <Info label="UUID" value={paiement.uuid} />
            <Info label="Type" value={paiement.type_paiement} />
            <Info label="Montant" value={`${formatMoney(paiement.montant)} FCFA`} />
            <Info label="Moyen de paiement" value={paiement.moyen_paiement || "-"} />
            <Info label="Ligne budgetaire" value={budgetLineLabel(paiement.lignes_budgetaires || paiement.demandes_paiement?.lignes_budgetaires)} />
            <Info label="Bénéficiaire" value={beneficiaireLabel} />
            <Info label="Comptable" value={comptableLabel} />
            <Info label="Créé" value={formatDateTime(paiement.created_at)} />
            <Info
              label="Demande"
              value={
                demandeUuid && canViewDemandeDetails ? (
                  <Link
                    to={`/demandes/${demandeUuid}`}
                    className="font-mono text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {demandeUuid}
                  </Link>
                ) : (
                  demandeUuid || "-"
                )
              }
            />
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents joints</div>
            {docsLoading ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement...</div>
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
