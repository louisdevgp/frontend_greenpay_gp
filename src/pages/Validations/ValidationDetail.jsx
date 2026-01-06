import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getValidationByUuid, listValidationsPending } from "../../services/validations.service";
import { listDocuments } from "../../services/documents.service";
import ValidationActionModal from "./ValidationActionModal";

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
function pickDemande(v) {
  return v?.demande || v?.demandes_paiement || v?.demande_paiement || null;
}

export default function ValidationDetail() {
  const { uuid } = useParams(); // ✅ uuid
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [validation, setValidation] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("approve");

  const demande = useMemo(() => pickDemande(validation), [validation]);

  // ✅ “actionnable” : adapte selon ton backend
  const isPending = useMemo(() => {
    const s = String(validation?.status || validation?.statut || validation?.state || "").toLowerCase();
    // si ton backend renvoie un champ précis, on ajustera
    return s.includes("pending") || s.includes("en_attente") || s.includes("waiting") || s === "";
  }, [validation]);

  const fetchValidation = async () => {
    setLoading(true);
    setError("");
    try {
      // 1) try get by uuid
      let res = null;
      try {
        res = await getValidationByUuid(uuid);
      } catch (e) {
        res = null;
      }

      if (res?.success && res?.data) {
        setValidation(res.data);
      } else {
        // 2) fallback: pending list + match uuid
        const pend = await listValidationsPending();
        if (!pend?.success) throw new Error(pend?.message || "Erreur pending validations");
        const found = (pend.data || []).find((x) => String(x.uuid) === String(uuid));
        if (!found) throw new Error("Validation introuvable");
        setValidation(found);
      }
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (demande_id) => {
    if (!demande_id) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments({ demande_id });
      if (res?.success) setDocuments(res.data || []);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  useEffect(() => {
    if (demande?.id) fetchDocs(demande.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demande?.id]);

  const openAction = (mode) => {
    setModalMode(mode);
    setModalOpen(true);
  };

  const onDone = async () => {
    await fetchValidation();
    nav("/validations/pending");
  };

  if (loading) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Chargement...</div>;
  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
        <button onClick={() => nav(-1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
          Retour
        </button>
      </div>
    );
  }

  const demandeUuid = demande?.uuid || "-";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Validation</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Validation UUID: <span className="font-mono">{validation?.uuid}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={() => nav(-1)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
            Retour
          </button>
          <button
            onClick={fetchValidation}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Demande */}
      <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Info label="Demande UUID" value={<span className="font-mono text-xs">{demandeUuid}</span>} />
          <Info label="Motif" value={demande?.motif || "-"} />
          <Info label="Bénéficiaire" value={demande?.beneficiaire || "-"} />
          <Info label="Montant" value={`${formatMoney(demande?.montant)} FCFA`} />
          <Info label="Statut demande" value={demande?.statut || "-"} />
          <Info label="Créée" value={formatDateTime(demande?.created_at)} />
        </div>

        <div className="mt-4 flex gap-2">
          {demandeUuid !== "-" ? (
            <Link
              to={`/demandes/${demandeUuid}`}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            >
              Voir détail demande
            </Link>
          ) : null}
        </div>
      </div>

      {/* Docs */}
      <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">Documents</h2>
          {docsLoading ? <span className="text-xs text-gray-500 dark:text-gray-400">Chargement...</span> : null}
        </div>

        {documents.length === 0 ? (
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

      {/* ✅ Boutons de validation */}
      {isPending ? (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => openAction("reject")}
            className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:opacity-90"
          >
            Rejeter
          </button>

          <button
            type="button"
            onClick={() => openAction("approve")}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Valider
          </button>
        </div>
      ) : (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Cette validation n’est plus modifiable.
        </div>
      )}

      <ValidationActionModal
        open={modalOpen}
        mode={modalMode}
        item={validation}
        onClose={() => setModalOpen(false)}
        onDone={onDone}
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
        {value}
      </div>
    </div>
  );
}
