import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getReception, visaDaf, visaDirecteur } from "../../services/receptions.service";
import { listDocuments, uploadManyDocuments } from "../../services/documents.service";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { downloadFile } from "../../utils/downloadFile";
import { useAuth } from "../../context/AuthContext";

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "-");
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

export default function ReceptionDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

  const canDownloadPdf = roles.includes("COMPTABLE") || roles.includes("DAF") || roles.includes("DIRECTEUR") || roles.includes("ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reception, setReception] = useState(null);

  const [docsLoading, setDocsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadType, setUploadType] = useState("bl");
  const [uploadFiles, setUploadFiles] = useState([]);

  const [visaLoading, setVisaLoading] = useState(false);
  const [visaError, setVisaError] = useState("");

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

  const canVisaDirecteur = (roles.includes("DIRECTEUR") || roles.includes("ADMIN")) && !reception?.visa_directeur_id;
  const canVisaDaf = (roles.includes("DAF") || roles.includes("ADMIN")) && !!reception?.visa_directeur_id && !reception?.visa_daf_id;

  const doVisa = async (kind) => {
    if (!reception?.id) return;
    setVisaError("");
    try {
      setVisaLoading(true);
      const res = kind === "directeur" ? await visaDirecteur(reception.id, {}) : await visaDaf(reception.id, {});
      if (!res?.success) throw new Error(res?.message || "Visa échoué");
      await fetchReception();
    } catch (e) {
      setVisaError(e?.message || "Erreur visa");
    } finally {
      setVisaLoading(false);
    }
  };

  const doUpload = async () => {
    if (!reception?.id) return;
    setUploadError("");
    try {
      if (!uploadFiles?.length) throw new Error("Veuillez choisir au moins un fichier");
      setUploading(true);
      const res = await uploadManyDocuments({
        files: uploadFiles,
        reception_id: reception.id,
        type_document: uploadType,
      });
      if (!res?.success) throw new Error(res?.message || "Upload échoué");
      setUploadFiles([]);
      await fetchDocs(reception.id);
    } catch (e) {
      setUploadError(e?.message || "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <FullscreenLoader show={loading} label="Chargement de la réception..." />

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
              <button onClick={() => nav(-1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
                Retour
              </button>
              {canDownloadPdf ? (
                <>
                  <button
                    type="button"
                    onClick={() => downloadFile(`/receptions/${reception.uuid || uuid}/pdf`, `reception_${reception.uuid || uuid}.pdf`)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                  >
                    Télécharger PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/receptions/${reception.uuid || uuid}/pdf`, `reception_${reception.uuid || uuid}.pdf`, {
                        mode: "preview",
                      })
                    }
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                  >
                    Prévisualiser PDF
                  </button>
                </>
              ) : null}
              <button
                onClick={fetchReception}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                Rafraîchir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info label="Receveur" value={reception.receveur_nom || "-"} />
            <Info label="Date réception" value={formatDateTime(reception.date_reception)} />
            <Info label="Créé" value={formatDateTime(reception.created_at)} />
            <Info label="Conforme" value={reception.conforme ? "Oui" : "Non"} />
            <Info label="Fournisseur" value={reception.fournisseur || "-"} />
            <Info label="Réf. facture" value={reception.reference_facture || "-"} />
            <Info label="Montant" value={reception.montant != null ? `${formatMoney(reception.montant)} FCFA` : "-"} />
            <Info label="Visa Directeur" value={reception.visa_directeur_id ? "Oui" : "Non"} />
            <Info label="Visa DAF" value={reception.visa_daf_id ? "Oui" : "Non"} />
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
                onClick={() => doVisa("directeur")}
                className={`px-4 py-2 text-sm rounded-lg ${
                  canVisaDirecteur
                    ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                Visa Directeur
              </button>

              <button
                type="button"
                disabled={!canVisaDaf || visaLoading}
                onClick={() => doVisa("daf")}
                className={`px-4 py-2 text-sm rounded-lg ${
                  canVisaDaf
                    ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                    : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                }`}
              >
                Visa DAF
              </button>
            </div>
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Paiement lié</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              UUID: <span className="font-mono">{reception?.paiements?.uuid || reception?.paiement_uuid || "-"}</span>
            </div>

            {reception?.paiements?.uuid ? (
              <div className="mt-3">
                <Link
                  to={`/paiements/${reception.paiements.uuid}`}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                >
                  Voir paiement
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
                    onChange={(e) => setUploadType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="bl">BL</option>
                    <option value="facture_definitive">Facture définitive</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
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
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-3 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                  >
                    <div>
                      <div className="font-medium">{doc.type_document || "document"}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{doc.nom_fichier}</div>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(doc.created_at)}</span>
                  </a>
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
