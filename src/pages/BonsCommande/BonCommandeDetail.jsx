import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { getBonCommande } from "../../services/bonsCommande.service";
import { downloadFile } from "../../utils/downloadFile";
import { useAuth } from "../../context/AuthContext";
import { labelBonCommandeStatut } from "../../utils/statusLabels";

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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function BonCommandeDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

  const canDownloadPdf =
    roles.includes("DEMANDEUR") ||
    roles.includes("RESPONSABLE") ||
    roles.includes("DIRECTEUR") ||
    roles.includes("DAF") ||
    roles.includes("DGA") ||
    roles.includes("DG") ||
    roles.includes("ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bc, setBc] = useState(null);

  const fetchBc = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getBonCommande(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement bon de commande");
      setBc(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  const items = Array.isArray(bc?.bon_commande_items) ? bc.bon_commande_items : [];
  const total = items.reduce((acc, it) => {
    const lineTotal = it?.total_ligne != null ? Number(it.total_ligne) : Number(it?.prix_unitaire || 0) * Number(it?.quantite || 0);
    return acc + (Number.isFinite(lineTotal) ? lineTotal : 0);
  }, 0);

  return (
    <div className="space-y-4">
      <FullscreenLoader show={loading} label="Chargement du bon de commande..." />

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

      {!error && bc ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail bon de commande</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                UUID: <span className="font-mono">{bc.uuid}</span>
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
                    onClick={() =>
                      downloadFile(`/bons-commande/${bc.uuid || uuid}/pdf`, `bon_commande_${bc.numero || bc.uuid || uuid}.pdf`)
                    }
                    className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                  >
                    Télécharger PDF
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadFile(`/bons-commande/${bc.uuid || uuid}/pdf`, `bon_commande_${bc.numero || bc.uuid || uuid}.pdf`, {
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
                onClick={fetchBc}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
              >
                Rafraîchir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info label="Numéro" value={bc.numero || "-"} mono />
            <Info label="Statut" value={labelBonCommandeStatut(bc.statut)} />
            <Info label="Date commande" value={formatDateTime(bc.date_commande)} />
            <Info label="Fournisseur" value={bc?.fournisseurs?.nom || bc?.fournisseurs?.raison_sociale || "-"} />
            <Info label="Total" value={`${formatMoney(total)} FCFA`} />
            <Info label="Créé" value={formatDateTime(bc.created_at)} />
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Demande liée</div>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              ID: <span className="font-mono">{bc.demande_id ?? "-"}</span>
            </div>
            {bc?.demandes_paiement?.uuid ? (
              <div className="mt-3">
                <Link
                  to={`/demandes/${bc.demandes_paiement.uuid}`}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                >
                  Voir la demande
                </Link>
              </div>
            ) : null}
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Items</div>

            {items.length === 0 ? (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun item.</div>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-3 py-2">Désignation</th>
                      <th className="px-3 py-2">Qté</th>
                      <th className="px-3 py-2">Unité</th>
                      <th className="px-3 py-2">PU</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => {
                      const pu = it?.prix_unitaire != null ? Number(it.prix_unitaire) : null;
                      const q = Number(it?.quantite || 0);
                      const lineTotal = it?.total_ligne != null ? Number(it.total_ligne) : pu != null ? pu * q : null;
                      return (
                        <tr key={it.id} className="border-t border-gray-100 dark:border-gray-800">
                          <td className="px-3 py-2">{it.designation}</td>
                          <td className="px-3 py-2">{q || "-"}</td>
                          <td className="px-3 py-2">{it.unite || "-"}</td>
                          <td className="px-3 py-2">{pu != null ? `${formatMoney(pu)} FCFA` : "-"}</td>
                          <td className="px-3 py-2 text-right">{lineTotal != null ? `${formatMoney(lineTotal)} FCFA` : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents</div>

            {Array.isArray(bc?.documents) && bc.documents.length ? (
              <div className="mt-3 space-y-2">
                {bc.documents.map((doc) => (
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
            ) : (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun document.</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Info({ label, value, mono = false }) {
  return (
    <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className={`mt-1 text-sm text-gray-800 dark:text-white/90 break-words ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
