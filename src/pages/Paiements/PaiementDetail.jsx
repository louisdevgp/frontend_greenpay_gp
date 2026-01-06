import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPaiement } from "../../services/paiements.service";

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function Badge({ children }) {
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs border rounded-lg border-gray-200 dark:border-gray-800">
      {children}
    </span>
  );
}

export default function PaiementDetail() {
  const { uuid } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  const paiement = data;
  const demande = data?.demandes_paiement || null;

  const title = useMemo(() => {
    if (!paiement) return "Paiement";
    return `Paiement #${paiement.id}`;
  }, [paiement]);

  const fetchOne = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getPaiement(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement paiement");
      setData(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  if (loading) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-3">
        <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
        <button
          type="button"
          onClick={fetchOne}
          className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!paiement) {
    return (
      <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <p className="text-sm text-gray-500 dark:text-gray-400">Aucune donnée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
            <Badge>{paiement.moyen_paiement || "-"}</Badge>
            <Badge>{paiement.type_paiement || "-"}</Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            UUID: <span className="font-mono">{paiement.uuid}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/paiements"
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Retour
          </Link>

          <button
            type="button"
            onClick={fetchOne}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Rafraîchir
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Paiement */}
        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">
            Informations paiement
          </h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info label="Montant" value={`${formatMoney(paiement.montant)} FCFA`} />
            <Info label="Date paiement" value={formatDate(paiement.date_paiement)} />
            <Info label="Demande ID" value={paiement.demande_id} />
            <Info label="Comptable ID" value={paiement.comptable_id ?? "-"} />
            <Info label="Référence pièce" value={paiement.reference_piece ?? "-"} />
            <Info label="Compte débité" value={paiement.compte_debite ?? "-"} />
          </div>

          <div className="mt-3">
            <div className="text-xs text-gray-500 dark:text-gray-400">Commentaire</div>
            <div className="mt-1 text-sm text-gray-800 dark:text-white/90">
              {paiement.commentaire || "-"}
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-white/90">Documents</h2>

          {Array.isArray(paiement.documents) && paiement.documents.length > 0 ? (
            <ul className="space-y-2">
              {paiement.documents.map((doc, idx) => (
                <li key={idx} className="p-2 text-sm border rounded-lg border-gray-200 dark:border-gray-800">
                  {/* Si plus tard doc = {url, type, name...} on affichera proprement */}
                  <pre className="text-xs whitespace-pre-wrap break-words">
                    {JSON.stringify(doc, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucun document attaché.
            </p>
          )}
        </div>
      </div>

      {/* Demande associée */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Demande associée
          </h2>

          {demande?.uuid ? (
            <Link
              to={`/demandes/${demande.uuid}`}
              className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
            >
              Ouvrir la demande
            </Link>
          ) : null}
        </div>

        {demande ? (
          <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Motif" value={demande.motif || "-"} />
            <Info label="Bénéficiaire" value={demande.beneficiaire || "-"} />
            <Info label="Statut" value={demande.statut || "-"} />
            <Info label="Montant" value={`${formatMoney(demande.montant)} FCFA`} />
            <Info label="Direction ID" value={demande.direction_id ?? "-"} />
            <Info label="Département ID" value={demande.departement_id ?? "-"} />
            <Info label="Service ID" value={demande.service_id ?? "-"} />
            <Info label="Créée le" value={formatDate(demande.created_at)} />
            <Info label="MAJ le" value={formatDate(demande.updated_at)} />
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="text-xs text-gray-500 dark:text-gray-400">Description</div>
              <div className="mt-1 text-sm text-gray-800 dark:text-white/90">
                {demande.description || "-"}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Aucune demande associée trouvée.
          </p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="p-3 border border-gray-100 rounded-lg dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">
        {value ?? "-"}
      </div>
    </div>
  );
}
