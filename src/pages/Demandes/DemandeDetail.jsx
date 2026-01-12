import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getDemande } from "../../services/demandes.services";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import CreatePaiementModal from "../Paiements/CreatePaiementModal";
import DemandeEditModal from "./DemandeEditModal";
import CreateBonCommandeModal from "../BonsCommande/CreateBonCommandeModal";
import { downloadFile } from "../../utils/downloadFile";
import { labelDemandeStatut, labelValidationStepStatus } from "../../utils/statusLabels";
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

function StatusBadge({ status }) {
  const v = String(status || "").toLowerCase();
  const cls =
    v === "valide"
      ? "bg-emerald-600 text-white"
      : v === "en_attente"
        ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
        : v === "rejete" || v === "rejetee" || v === "rejeté"
          ? "bg-red-600 text-white"
          : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs rounded-lg ${cls}`}>{labelValidationStepStatus(status)}</span>
  );
}

export default function DemandeDetail() {
  const { uuid } = useParams();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

  const canPayRole = roles.includes("DAF") || roles.includes("COMPTABLE") || roles.includes("ADMIN");
  const canDownloadPdf =
    roles.includes("DEMANDEUR") ||
    roles.includes("DIRECTEUR") ||
    roles.includes("DAF") ||
    roles.includes("DGA") ||
    roles.includes("DG") ||
    roles.includes("COMPTABLE") ||
    roles.includes("ADMIN");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [demande, setDemande] = useState(null);

  const [docsLoading, setDocsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bcOpen, setBcOpen] = useState(false);

  const canPayThis = useMemo(() => {
    const s = String(demande?.statut || "").toLowerCase();
    return canPayRole && (s === "approuvee" || s === "en_attente_paiement");
  }, [demande?.statut, canPayRole]);

  const canCreateBc = useMemo(() => {
    const s = String(demande?.statut || "").toLowerCase();
    const allowedRole = roles.includes("ADMIN") || roles.includes("DAF") || roles.includes("DIRECTEUR") || roles.includes("RESPONSABLE") || roles.includes("DEMANDEUR");
    return allowedRole && (s === "approuvee" || s === "en_attente_paiement");
  }, [demande?.statut, roles]);

  // ✅ règle simple UI : si au moins un step valide => plus d'édition complète
  const hasAnyValidation = useMemo(() => {
    const steps = demande?.validation_steps || [];
    return steps.some((x) => {
      const s = String(x?.status || "").toLowerCase();
      return s === "valide" || s === "rejete" || s === "rejetee" || s === "rejeté";
    });
  }, [demande?.validation_steps]);

  const isEngaged = useMemo(() => {
    const statut = String(demande?.statut || "").toLowerCase();
    const isEditableStage = statut === "draft" || statut === "brouillon" || statut === "soumise" || statut.startsWith("validation_");
    return hasAnyValidation || !isEditableStage;
  }, [demande?.statut, hasAnyValidation]);

  const canEditAll = !isEngaged;

  const currentStep = useMemo(() => {
    const steps = Array.isArray(demande?.validation_steps) ? demande.validation_steps : [];
    const s = steps.find((x) => String(x?.status || "").toLowerCase() === "en_attente");
    return s || null;
  }, [demande?.validation_steps]);

  const fetchDemande = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getDemande(uuid);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement demande");
      setDemande(res.data);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchDocs = async (demandeId) => {
    setDocsLoading(true);
    try {
      const res = await listDocuments({ demande_id: demandeId });
      if (!res?.success) throw new Error(res?.message || "Erreur chargement documents");
      setDocuments(res.data || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchDemande();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  useEffect(() => {
    if (demande?.id) fetchDocs(demande.id);
  }, [demande?.id]);

  if (loading) return <div className="text-sm text-gray-500 dark:text-gray-400">Chargement...</div>;
  if (error) return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail demande</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            UUID: <span className="font-mono">{demande?.uuid}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchDemande}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Rafraîchir
          </button>

          {canDownloadPdf ? (
            <>
              <button
                type="button"
                onClick={() =>
                  downloadFile(`/demandes/${demande?.uuid || uuid}/pdf`, `demande_${demande?.uuid || uuid}.pdf`)
                }
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
              >
                Télécharger PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(`/demandes/${demande?.uuid || uuid}/pdf`, `demande_${demande?.uuid || uuid}.pdf`, {
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
            type="button"
            disabled={!canEditAll}
            onClick={() => canEditAll && setEditOpen(true)}
            className={`px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 ${
              canEditAll ? "" : "opacity-60 cursor-not-allowed"
            }`}
          >
            Modifier
          </button>

          <button
            type="button"
            disabled={!canPayThis}
            onClick={() => setPayOpen(true)}
            className={`px-4 py-2 text-sm rounded-lg ${
              canPayThis
                ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            Payer
          </button>

          <button
            type="button"
            disabled={!canCreateBc}
            onClick={() => setBcOpen(true)}
            className={`px-4 py-2 text-sm rounded-lg ${
              canCreateBc
                ? "bg-emerald-600 text-white hover:opacity-90"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            Créer BC
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Info label="Motif" value={demande?.motif || "-"} />
        <Info label="Bénéficiaire" value={demande?.beneficiaire || "-"} />
        <Info label="Statut" value={labelDemandeStatut(demande?.statut)} />
        <Info label="Montant" value={`${formatMoney(demande?.montant)} FCFA`} />
        <Info label="Créée le" value={formatDateTime(demande?.created_at)} />
        <Info label="MàJ le" value={formatDateTime(demande?.updated_at)} />
      </div>

      {/* Description */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="text-sm font-medium text-gray-800 dark:text-white/90">Description</div>
        <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
          {demande?.description || "-"}
        </div>
      </div>

      {/* Items */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="text-sm font-medium text-gray-800 dark:text-white/90">Lignes (items)</div>

        {Array.isArray(demande?.demande_items) && demande.demande_items.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2">Désignation</th>
                  <th className="px-3 py-2">Qté</th>
                  <th className="px-3 py-2">PU</th>
                  <th className="px-3 py-2">Unité</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Spécifications</th>
                </tr>
              </thead>
              <tbody>
                {demande.demande_items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{it.designation}</td>
                    <td className="px-3 py-2">{it.quantite != null ? String(it.quantite) : "-"}</td>
                    <td className="px-3 py-2">{it.prix_unitaire != null ? `${formatMoney(it.prix_unitaire)}` : "-"}</td>
                    <td className="px-3 py-2">{it.unite || "-"}</td>
                    <td className="px-3 py-2">{it.total_ligne != null ? `${formatMoney(it.total_ligne)}` : "-"}</td>
                    <td className="px-3 py-2">{it.specifications || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucune ligne.</div>
        )}
      </div>

      {/* Parcours validations */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Parcours validations</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Étape courante: {currentStep?.role_name ? <span className="font-medium">{currentStep.role_name}</span> : "-"}
            </div>
          </div>
        </div>

        {Array.isArray(demande?.validation_steps) && demande.validation_steps.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2">Niveau</th>
                  <th className="px-3 py-2">Rôle</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Validé le</th>
                  <th className="px-3 py-2">Commentaire</th>
                </tr>
              </thead>
              <tbody>
                {demande.validation_steps
                  .slice()
                  .sort((a, b) => Number(a.level || 0) - Number(b.level || 0))
                  .map((s) => (
                    <tr key={s.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">{s.level ?? "-"}</td>
                      <td className="px-3 py-2">{s.role_name || "-"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-3 py-2">{formatDateTime(s.validated_at)}</td>
                      <td className="px-3 py-2">{s.commentaire || "-"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucune étape de validation.</div>
        )}
      </div>

      {/* Documents */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents liés</div>
          <button
            type="button"
            onClick={() => demande?.id && fetchDocs(demande.id)}
            className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Recharger
          </button>
        </div>

        {docsLoading ? (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement documents...</div>
        ) : documents.length === 0 ? (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun document.</div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Nom fichier</th>
                  <th className="px-3 py-2">Format</th>
                  <th className="px-3 py-2">Taille</th>
                  <th className="px-3 py-2">Créé</th>
                  <th className="px-3 py-2 text-right">Ouvrir</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{doc.type_document}</td>
                    <td className="px-3 py-2">{doc.nom_fichier}</td>
                    <td className="px-3 py-2">{doc.format}</td>
                    <td className="px-3 py-2">{doc.taille ? Number(doc.taille).toLocaleString("fr-FR") : "-"}</td>
                    <td className="px-3 py-2">{formatDateTime(doc.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                      >
                        Ouvrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bons de commande */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-gray-800 dark:text-white/90">Bons de commande</div>
          <button
            type="button"
            disabled={!canCreateBc}
            onClick={() => setBcOpen(true)}
            className={`px-3 py-2 text-xs rounded-lg ${
              canCreateBc ? "bg-emerald-600 text-white hover:opacity-90" : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            Nouveau
          </button>
        </div>

        {Array.isArray(demande?.bons_commande) && demande.bons_commande.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2">Numéro</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Documents</th>
                  <th className="px-3 py-2 text-right">PDF</th>
                </tr>
              </thead>
              <tbody>
                {demande.bons_commande.map((bc) => (
                  <tr key={bc.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2 font-mono text-xs">
                      <Link
                        to={`/bons-commande/${bc.uuid || bc.id}`}
                        className="hover:underline"
                      >
                        {bc.numero || bc.uuid}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{labelBonCommandeStatut(bc.statut)}</td>
                    <td className="px-3 py-2">{formatDateTime(bc.date_commande)}</td>
                    <td className="px-3 py-2">
                      {Array.isArray(bc?.documents) && bc.documents.length ? (
                        <div className="flex flex-wrap gap-2">
                          {bc.documents.slice(0, 3).map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                              title={doc.nom_fichier}
                            >
                              {doc.nom_fichier || doc.type_document || "document"}
                            </a>
                          ))}
                          {bc.documents.length > 3 ? (
                            <span className="text-xs text-gray-500 dark:text-gray-400">+{bc.documents.length - 3}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">Aucun</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canDownloadPdf ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              downloadFile(
                                `/bons-commande/${bc.uuid || bc.id}/pdf`,
                                `bon_commande_${bc.numero || bc.uuid || bc.id}.pdf`
                              )
                            }
                            className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                          >
                            Télécharger
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadFile(
                                `/bons-commande/${bc.uuid || bc.id}/pdf`,
                                `bon_commande_${bc.numero || bc.uuid || bc.id}.pdf`,
                                { mode: "preview" }
                              )
                            }
                            className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                          >
                            Prévisualiser
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun bon de commande.</div>
        )}
      </div>

      {/* Modal edit */}
      <DemandeEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        demande={demande}
        canEditAll={canEditAll}
        onUpdated={() => {
          fetchDemande();
          demande?.id && fetchDocs(demande.id);
        }}
      />

      {/* Modal paiement */}
      <CreatePaiementModal
        open={payOpen}
        demande={demande}
        onClose={() => setPayOpen(false)}
        onCreated={() => {
          fetchDemande();
          demande?.id && fetchDocs(demande.id);
        }}
      />

      {/* Modal bon de commande */}
      <CreateBonCommandeModal
        open={bcOpen}
        demande={demande}
        onClose={() => setBcOpen(false)}
        onCreated={() => {
          fetchDemande();
        }}
      />
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
