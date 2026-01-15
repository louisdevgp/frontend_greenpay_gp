import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getDemande } from "../../services/demandes.services";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import CreatePaiementModal from "../Paiements/CreatePaiementModal";
import DemandeEditModal from "./DemandeEditModal";
import { createBonCommande } from "../../services/bonsCommande.service";
import { emitToast } from "../../services/toastBus";
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

function labelPaiementMode(mode) {
  const v = String(mode || "").toUpperCase().replaceAll(" ", "");
  if (v === "70/30" || v === "50/50" || v === "100/100") return v;
  return v ? v : "-";
}

function TrancheBadge({ statut }) {
  const v = String(statut || "").toLowerCase();
  const paid = v === "paye" || v === "payee" || v === "payé" || v === "payée";
  const cls = paid
    ? "bg-emerald-600 text-white"
    : "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200";
  return <span className={`inline-flex items-center px-2 py-1 text-xs rounded-lg ${cls}`}>{paid ? "Payée" : "Prévue"}</span>;
}

export default function DemandeDetail() {
  const { uuid } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const userAgentId = user?.agent?.id != null ? Number(user.agent.id) : null;

  const canPayRole = roles.includes("DAF") || roles.includes("COMPTABLE") || roles.includes("ADMIN");
  const canDownloadPdfRole =
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

  const statutLower = String(demande?.statut || "").toLowerCase();
  const isDraft = statutLower === "draft" || statutLower === "brouillon";
  const canDownloadPdf = canDownloadPdfRole && (!isDraft || roles.includes("ADMIN"));

  const [docsLoading, setDocsLoading] = useState(true);
  const [documents, setDocuments] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [bcCreating, setBcCreating] = useState(false);
  const [bcConfirmArmed, setBcConfirmArmed] = useState(false);
  const bcConfirmTimerRef = useRef(null);

  const canPayThis = useMemo(() => {
    const s = String(demande?.statut || "").toLowerCase();
    return canPayRole && (s === "approuvee" || s === "en_attente_paiement" || s === "receptionnee");
  }, [demande?.statut, canPayRole]);

  const canCreateBc = useMemo(() => {
    const s = String(demande?.statut || "").toLowerCase();
    const allowedRole = roles.includes("ADMIN") || roles.includes("DAF") || roles.includes("DIRECTEUR") || roles.includes("RESPONSABLE") || roles.includes("DEMANDEUR");
    const hasAnyBc = Array.isArray(demande?.bons_commande) && demande.bons_commande.length > 0;
    return !hasAnyBc && allowedRole && (s === "approuvee" || s === "en_attente_paiement");
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

  const canEditThisDemande = useMemo(() => {
    const isAdmin = roles.includes("ADMIN");
    const demandeurId = demande?.demandeur_id != null ? Number(demande.demandeur_id) : null;
    const isOwner = userAgentId != null && demandeurId != null && userAgentId === demandeurId;
    return canEditAll && (isAdmin || isOwner);
  }, [canEditAll, demande?.demandeur_id, roles, userAgentId]);

  const currentStep = useMemo(() => {
    const steps = Array.isArray(demande?.validation_steps) ? demande.validation_steps : [];
    const s = steps.find((x) => String(x?.status || "").toLowerCase() === "en_attente");
    return s || null;
  }, [demande?.validation_steps]);

  const paiementConditions = useMemo(() => {
    const raw = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    return raw
      .filter(Boolean)
      .slice()
      .sort((a, b) => {
        const pa = Number(a?.pourcentage ?? 0);
        const pb = Number(b?.pourcentage ?? 0);
        if (pb !== pa) return pb - pa;
        return String(a?.id ?? "").localeCompare(String(b?.id ?? ""));
      });
  }, [demande?.conditions_paiement]);

  const paiementMode = useMemo(() => {
    const direct = demande?.conditions_paiement_mode;
    if (direct) return labelPaiementMode(direct);

    const ps = paiementConditions.map((x) => Number(x?.pourcentage ?? 0)).filter((x) => Number.isFinite(x));
    if (ps.length === 1 && ps[0] === 100) return "100/100";
    if (ps.length === 2) {
      const s = ps.slice().sort((a, b) => b - a);
      if (s[0] === 70 && s[1] === 30) return "70/30";
      if (s[0] === 50 && s[1] === 50) return "50/50";
    }
    return paiementConditions.length ? "PERSONNALISÉ" : "-";
  }, [demande?.conditions_paiement_mode, paiementConditions]);

  const unpaidTranches = useMemo(() => {
    return paiementConditions.filter((t) => {
      const statut = String(t?.statut || "").toLowerCase();
      const paid =
        statut === "paye" ||
        statut === "payee" ||
        statut === "payé" ||
        statut === "payée" ||
        Boolean(t?.paiement_id);
      return !paid;
    });
  }, [paiementConditions]);

  const remainingAmount = useMemo(() => {
    return unpaidTranches.reduce((sum, t) => sum + Number(t?.montant_prevu ?? 0), 0);
  }, [unpaidTranches]);

  const nextTranche = unpaidTranches.length ? unpaidTranches[0] : null;

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

  const documentsSorted = useMemo(() => {
    const docs = Array.isArray(documents) ? documents : [];
    return docs
      .slice()
      .sort((a, b) => {
        const ta = String(a?.type_document || "").toLowerCase();
        const tb = String(b?.type_document || "").toLowerCase();

        // proforma en premier
        const pa = ta === "proforma" ? 0 : 1;
        const pb = tb === "proforma" ? 0 : 1;
        if (pa !== pb) return pa - pb;

        // puis tri par date décroissante (fallback id)
        const da = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const db = b?.created_at ? new Date(b.created_at).getTime() : 0;
        if (db !== da) return db - da;
        return Number(b?.id || 0) - Number(a?.id || 0);
      });
  }, [documents]);

  const proformaCount = useMemo(() => {
    return (Array.isArray(documents) ? documents : []).filter(
      (d) => String(d?.type_document || "").toLowerCase() === "proforma"
    ).length;
  }, [documents]);

  useEffect(() => {
    fetchDemande();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  useEffect(() => {
    if (demande?.id) fetchDocs(demande.id);
  }, [demande?.id]);

  useEffect(() => {
    return () => {
      if (bcConfirmTimerRef.current) {
        clearTimeout(bcConfirmTimerRef.current);
        bcConfirmTimerRef.current = null;
      }
    };
  }, []);

  const onCreateBcFromDemande = async () => {
    if (bcCreating) return;

    const demandeId = demande?.id;
    if (!demandeId) {
      emitToast({ variant: "error", message: "Demande introuvable" });
      return;
    }

    const rawItems = Array.isArray(demande?.demande_items) ? demande.demande_items : [];
    if (rawItems.length === 0) {
      emitToast({ variant: "error", message: "Impossible: aucune ligne (item) sur la demande." });
      return;
    }

    const items = rawItems
      .map((it) => ({
        designation: String(it?.designation || "").trim(),
        quantite: Number(it?.quantite ?? 0),
        prix_unitaire: it?.prix_unitaire !== "" && it?.prix_unitaire != null ? Number(it.prix_unitaire) : null,
        unite: it?.unite ? String(it.unite).trim() : null,
      }))
      .filter((it) => it.designation && Number.isFinite(it.quantite) && it.quantite > 0);

    if (items.length === 0) {
      emitToast({
        variant: "error",
        message: "Aucune ligne valide (designation/quantité). Corrigez la demande puis réessayez.",
      });
      return;
    }

    try {
      setBcCreating(true);

      const payload = {
        demande_id: demandeId,
        date_commande: new Date().toISOString(),
        statut: "brouillon",
        items,
      };

      const res = await createBonCommande(payload);
      if (!res?.success) throw new Error(res?.message || "Création bon de commande échouée");

      const bc = res?.data;
      emitToast({ variant: "success", message: "Bon de commande créé." });

      const bcIdOrUuid = bc?.uuid || bc?.id;
      if (bcIdOrUuid) nav(`/bons-commande/${bcIdOrUuid}`);
      else fetchDemande();
    } catch (e) {
      emitToast({ variant: "error", message: e?.message || "Erreur création bon de commande" });
    } finally {
      setBcCreating(false);
    }
  };

  const onCreateBcClick = async () => {
    if (bcCreating) return;
    if (!bcConfirmArmed) {
      setBcConfirmArmed(true);
      emitToast({ variant: "info", message: "Cliquez encore pour confirmer la création du bon de commande." });
      if (bcConfirmTimerRef.current) clearTimeout(bcConfirmTimerRef.current);
      bcConfirmTimerRef.current = setTimeout(() => {
        setBcConfirmArmed(false);
        bcConfirmTimerRef.current = null;
      }, 4000);
      return;
    }

    setBcConfirmArmed(false);
    if (bcConfirmTimerRef.current) {
      clearTimeout(bcConfirmTimerRef.current);
      bcConfirmTimerRef.current = null;
    }
    await onCreateBcFromDemande();
  };

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
            disabled={!canEditThisDemande}
            onClick={() => canEditThisDemande && setEditOpen(true)}
            className={`px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 ${
              canEditThisDemande ? "hover:bg-gray-50 dark:hover:bg-gray-950" : "opacity-50 cursor-not-allowed"
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
            disabled={!canCreateBc || bcCreating}
            onClick={onCreateBcClick}
            className={`px-4 py-2 text-sm rounded-lg ${
              canCreateBc && !bcCreating
                ? bcConfirmArmed
                  ? "bg-amber-500 text-white hover:opacity-90"
                  : "bg-emerald-600 text-white hover:opacity-90"
                : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            {bcCreating ? "Création..." : bcConfirmArmed ? "Confirmer BC" : "Créer BC"}
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

      {/* Conditions de paiement */}
      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Conditions de paiement</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Mode: <span className="font-medium text-gray-800 dark:text-white/90">{paiementMode}</span>
            </div>
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-300">
            <div>
              Restant: <span className="font-medium">{formatMoney(remainingAmount)} FCFA</span>
            </div>
            <div>
              Prochaine tranche: {nextTranche ? (
                <span className="font-medium">
                  {Number(nextTranche?.pourcentage ?? 0)}% ({formatMoney(nextTranche?.montant_prevu)} FCFA)
                </span>
              ) : (
                <span className="font-medium">-</span>
              )}
            </div>
          </div>
        </div>

        {paiementConditions.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
                <tr>
                  <th className="px-3 py-2">Tranche</th>
                  <th className="px-3 py-2">%</th>
                  <th className="px-3 py-2">Montant prévu</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2">Paiement</th>
                </tr>
              </thead>
              <tbody>
                {paiementConditions.map((t, idx) => (
                  <tr key={t.id ?? idx} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">Tranche {idx + 1}</td>
                    <td className="px-3 py-2">{t?.pourcentage != null ? `${Number(t.pourcentage)}%` : "-"}</td>
                    <td className="px-3 py-2">{t?.montant_prevu != null ? `${formatMoney(t.montant_prevu)} FCFA` : "-"}</td>
                    <td className="px-3 py-2">
                      <TrancheBadge statut={t?.statut} />
                    </td>
                    <td className="px-3 py-2">
                      {t?.paiement_id ? <span className="font-mono text-xs">{String(t.paiement_id)}</span> : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucune tranche (ancien enregistrement ou non initialisé).</div>
        )}
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
          <div className="text-sm font-medium text-gray-800 dark:text-white/90">
            Documents liés{proformaCount ? (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({proformaCount} proforma)</span>
            ) : null}
          </div>
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
        ) : documentsSorted.length === 0 ? (
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
                {documentsSorted.map((doc) => (
                  <tr key={doc.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-3 py-2">{doc.type_document}</td>
                    <td className="px-3 py-2">{doc.nom_fichier}</td>
                    <td className="px-3 py-2">{doc.format}</td>
                    <td className="px-3 py-2">{doc.taille ? Number(doc.taille).toLocaleString("fr-FR") : "-"}</td>
                    <td className="px-3 py-2">{formatDateTime(doc.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          downloadFile(`/documents/${doc.id}/download`, doc.nom_fichier || `document_${doc.id}`, { mode: "preview" })
                        }
                        className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                      >
                        Ouvrir
                      </button>
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
            disabled={!canCreateBc || bcCreating}
            onClick={onCreateBcClick}
            className={`px-3 py-2 text-xs rounded-lg ${
              canCreateBc && !bcCreating
                ? bcConfirmArmed
                  ? "bg-amber-500 text-white hover:opacity-90"
                  : "bg-emerald-600 text-white hover:opacity-90"
                : "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            {bcCreating ? "Création..." : bcConfirmArmed ? "Confirmer" : "Nouveau"}
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
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() =>
                                downloadFile(`/documents/${doc.id}/download`, doc.nom_fichier || `document_${doc.id}`, { mode: "preview" })
                              }
                              className="px-2 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                              title={doc.nom_fichier}
                            >
                              {doc.nom_fichier || doc.type_document || "document"}
                            </button>
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
        canEditAll={canEditThisDemande}
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
