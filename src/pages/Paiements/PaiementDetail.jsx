import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getPaiement } from "../../services/paiements.service";
import { listDocuments, uploadManyDocuments } from "../../services/documents.service";
import { listReceptions } from "../../services/receptions.service";
import FullscreenLoader from "../../components/common/FullScreenLoader";
// PaiementDetail.jsx
import CreateReceptionModal from "../Receptions/CreateReceptionModal"; // ✅ ajuste le chemin selon ton arbo
import { downloadFile } from "../../utils/downloadFile";


function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}
function formatDateTime(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export default function PaiementDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paiement, setPaiement] = useState(null);

  const [docsLoading, setDocsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [openReception, setOpenReception] = useState(false);
  const [hasReception, setHasReception] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState("preuve_paiement");
  const [uploadTypeAutre, setUploadTypeAutre] = useState("");
  const [uploadFiles, setUploadFiles] = useState([]);

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

  useEffect(() => { fetchPaiement(); }, [uuid]);

  useEffect(() => {
    if (paiement?.id) fetchDocs(paiement.id);
  }, [paiement?.id]);

  useEffect(() => {
    const loadReceptionState = async () => {
      try {
        const demandeId = paiement?.demande_id;
        if (!demandeId) {
          setHasReception(false);
          return;
        }

        const res = await listReceptions({ demande_id: demandeId });
        const rows = res?.success ? (res.data || []) : [];
        setHasReception(Array.isArray(rows) && rows.length > 0);
      } catch {
        // ne bloque pas la page
        setHasReception(false);
      }
    };

    if (paiement?.id) loadReceptionState();
  }, [paiement?.id, paiement?.demande_id]);

  const doUpload = async () => {
    if (!paiement?.id) return;
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
        type_document: typeDoc,
        paiement_id: paiement.id,
      });
      if (!res?.success) throw new Error(res?.message || "Upload échoué");
      setUploadFiles([]);
      setUploadTypeAutre("");
      await fetchDocs(paiement.id);
    } catch (e) {
      setUploadError(e?.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FullscreenLoader show={loading} label="Chargement du paiement..." />

      {error ? (
        <div className="p-4 space-y-3">
          <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
          <button onClick={() => nav(-1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
            Retour
          </button>
        </div>
      ) : null}

      {!error && paiement ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail paiement</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{paiement.uuid}</span>
              </p>
            </div>

            <div className="flex gap-2">
              <button onClick={() => nav(-1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
                Retour
              </button>
              <button
                onClick={fetchPaiement}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                Rafraîchir
              </button>
              {/* ✅ Créer réception depuis paiement */}
              <button
                type="button"
                disabled={hasReception}
                onClick={() => !hasReception && setOpenReception(true)}
                className={`px-4 py-2 text-sm rounded-lg ${
                  hasReception ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500" : "bg-emerald-600 text-white hover:opacity-90"
                }`}
              >
                {hasReception ? "Réception déjà créée" : "Créer réception"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info label="Type" value={paiement.type_paiement} />
            <Info label="Montant" value={`${formatMoney(paiement.montant)} FCFA`} />
            <Info label="Moyen" value={paiement.moyen_paiement} />
            <Info label="Date paiement" value={formatDateTime(paiement.date_paiement)} />
            <Info label="Créé" value={formatDateTime(paiement.created_at)} />
            <Info label="Référence" value={paiement.reference_piece || "-"} />
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Commentaire</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
              {String(paiement?.commentaire || "").trim() || "-"}
            </div>
          </div>

          {/* Lien demande si dispo */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Demande liée</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              UUID:{" "}
              <span className="font-mono">
                {paiement?.demandes_paiement?.uuid || paiement?.demande_uuid || "-"}
              </span>
            </div>
            {paiement?.demandes_paiement?.uuid ? (
              <div className="mt-3">
                <Link
                  to={`/demandes/${paiement.demandes_paiement.uuid}`}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                >
                  Voir la demande
                </Link>
              </div>
            ) : null}
          </div>

          {/* Documents */}
          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents du paiement</div>
              <button
                type="button"
                onClick={() => paiement?.id && fetchDocs(paiement.id)}
                className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
              >
                Recharger
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
                    <option value="preuve_paiement">Preuve paiement</option>
                    <option value="ordre_virement">Ordre de virement</option>
                    <option value="recu">Reçu</option>
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
                      placeholder="Ex: avis de débit"
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
                  className={`px-4 py-2 text-sm rounded-lg ${
                    uploading || !uploadFiles.length
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                      : "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                  }`}
                >
                  {uploading ? "Upload..." : "Uploader"}
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
      {/* ✅ Modal création réception */}
      <div>
        <CreateReceptionModal
          open={openReception}
          paiement={paiement}                 // ✅ on passe le paiement
          onClose={() => setOpenReception(false)}
          onCreated={async () => {
            // refresh paiement + redirection vers la réception si tu veux
            await fetchPaiement();
            // optionnel : nav("/receptions"); ou nav(`/receptions/${uuid}`)
          }}
        />
      </div>
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
