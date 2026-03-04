import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { FiArrowLeft, FiDownload, FiEye, FiRefreshCw } from "react-icons/fi";
import { getPaiement } from "../../services/paiements.service";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import LoadingButton from "../../components/common/LoadingButton";
import { downloadFile } from "../../utils/downloadFile";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";

export default function PaiementDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { hasPermission, hasAnyPermission } = useAuth();

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

  const canDownloadPdf = hasPermission("PAIEMENT_GET");
  const canViewDemandeDetails = hasAnyPermission([
    "DEMANDE_LIST",
    "DEMANDE_LIST_SELF",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
  ]);

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
              {canDownloadPdf ? (
                <LoadingButton
                  type="button"
                  onClick={() =>
                    runDownload("paiement-pdf", () =>
                      downloadFile(`/paiements/${paiement.uuid}/pdf`, `paiement_${paiement.uuid}.pdf`)
                    )
                  }
                  loading={isDownloading("paiement-pdf")}
                  title="Télécharger PDF"
                  aria-label="Télécharger PDF"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  {isDownloading("paiement-pdf") ? null : <FiDownload />}
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
            <Info label="Bénéficiaire" value={paiement.beneficiaire} />
            <Info label="Créé" value={formatDateTime(paiement.created_at)} />
            <Info label="Demande" value={paiement.demandes_paiement?.uuid || "-"} />
          </div>

          {paiement.demandes_paiement && canViewDemandeDetails ? (
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Demande liée</div>
              <div className="mt-2">
                <Link
                  to={`/demandes/${paiement.demandes_paiement.uuid}`}
                  title="Voir la demande"
                  aria-label="Voir la demande"
                  className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800"
                >
                  <FiEye />
                </Link>
              </div>
            </div>
          ) : null}

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents joints</div>
            {docsLoading ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement...</div>
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
