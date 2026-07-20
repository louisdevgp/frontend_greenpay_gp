import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiDownload, FiEye, FiFilePlus, FiRefreshCw } from "react-icons/fi";
import { listReceptions } from "../../services/receptions.service";
import { listAllDemandes } from "../../services/demandes.services";
import Pagination from "../../components/common/Pagination";
import Loader from "../../components/common/Loader";
import LoadingButton from "../../components/common/LoadingButton";
import ExportButton from "../../components/common/ExportButton";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";
import DatePicker from "../../components/form/date-picker";
import { useAuth } from "../../context/AuthContext";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { labelDemandeStatut, demandeStatusBadgeClass } from "../../utils/statusLabels";
import CreateReceptionModal from "./CreateReceptionModal";
import { downloadFile } from "../../utils/downloadFile";
import { exportRowsToExcel } from "../../utils/excelExport";
import { useRealtime } from "../../context/RealtimeContext.tsx";
import DemandAttachmentsIndicator from "../../components/common/DemandAttachmentsIndicator";

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function formatPhase(value) {
  const v = String(value || "").trim().toUpperCase();
  if (v === "AVANT_PAIEMENT") return "Avant paiement";
  if (v === "APRES_PAIEMENT") return "Après paiement";
  return "-";
}

function mergeDateAndTime(dateOnly, timeSource) {
  if (!dateOnly) return timeSource || null;
  const d = dateOnly instanceof Date ? dateOnly : new Date(dateOnly);
  if (Number.isNaN(d.getTime())) return timeSource || null;
  const t = timeSource ? new Date(timeSource) : null;
  if (!t || Number.isNaN(t.getTime())) return d;
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    t.getHours(),
    t.getMinutes(),
    t.getSeconds(),
    t.getMilliseconds()
  );
}

const initialState = {
  filters: { reference: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function ReceptionsList({ mode = "all" }) {
  const { user, hasPermission, hasAnyPermission } = useAuth();
  const { receptionsTick } = useRealtime();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const delegatedRoles = (user?.agent?.delegations || [])
    .map((d) => String(d?.role_name || "").toUpperCase())
    .filter(Boolean);
  const effectiveRoles = new Set([...roles, ...delegatedRoles]);
  const directionId = user?.agent?.direction_id ?? user?.agent?.directionId ?? null;
  const modeKey = String(mode || "all").trim().toLowerCase();

  const storageKey = useMemo(() => {
    if (modeKey === "pending") return "filters:receptions:pending";
    if (modeKey === "done") return "filters:receptions:done";
    return "filters:receptions:list";
  }, [modeKey]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDemande, setSelectedDemande] = useState(null);
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

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(storageKey);
    return saved ? { ...initialState, ...saved } : initialState;
  });

  useEffect(() => {
    const saved = loadPersistedState(storageKey);
    setState(saved ? { ...initialState, ...saved } : initialState);
  }, [storageKey]);

  const isDirectorOnlyView = effectiveRoles.has("DIRECTEUR") && !effectiveRoles.has("DAF");
  const isDafRequired = (r) => r?.visa_daf_requis !== false;
  const isDoneForDaf = (r) => !!r?.visa_directeur_id && (!isDafRequired(r) || !!r?.visa_daf_id);
  const isPendingForDaf = (r) => !!r?.visa_directeur_id && isDafRequired(r) && !r?.visa_daf_id;
  const isPendingForDirector = (r) => !r?.visa_directeur_id;
  const canShowDemandes = modeKey === "pending" && isDirectorOnlyView;
  const [pendingView, setPendingView] = useState("receptions");
  const showDemandes = canShowDemandes && pendingView === "demandes";

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      if (showDemandes) {
        const params = {
          page: state.page,
          pageSize: state.pageSize,
          statut: "approuvee,en_attente_paiement,achat_effectue,paye,payee",
          ...(directionId ? { direction_id: Number(directionId), roleView: "DIRECTION" } : {}),
        };

        const res = await listAllDemandes(params);
        if (!res?.success) throw new Error(res?.message || "Erreur chargement demandes");
        const rows = res.data || [];
        setData(rows);
        setFiltered(rows);
      } else {
        const params = {
          page: state.page,
          pageSize: state.pageSize,
          ...(state.filters.reference ? { reference: state.filters.reference } : {}),
          ...(state.filters.dateStart ? { date_debut: state.filters.dateStart } : {}),
          ...(state.filters.dateEnd ? { date_fin: state.filters.dateEnd } : {}),
        };

        const res = await listReceptions(params);
        if (!res?.success) throw new Error(res?.message || "Erreur chargement réceptions");
        const rows = res.data || [];
        const scoped =
          modeKey === "pending"
            ? rows.filter((r) => {
                const wantsDirector = effectiveRoles.has("DIRECTEUR") && isPendingForDirector(r);
                const wantsDaf = effectiveRoles.has("DAF") && isPendingForDaf(r);
                return wantsDirector || wantsDaf;
              })
            : modeKey === "done"
              ? (isDirectorOnlyView ? rows : rows.filter((r) => isDoneForDaf(r)))
              : rows;
        setData(scoped);
        setFiltered(scoped);
      }
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
      setData([]);
      setFiltered([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, [state.page, state.pageSize, state.filters, modeKey, showDemandes]);

  useEffect(() => {
    if (receptionsTick > 0) fetch();
  }, [receptionsTick]);

  useEffect(() => {
    if (state.filters.reference || state.filters.dateStart || state.filters.dateEnd) {
      const filtered = (data || []).filter((row) => {
        if (state.filters.reference) {
          const needle = String(state.filters.reference).toLowerCase();
          if (showDemandes) {
            const motif = String(row.motif || "").toLowerCase();
            const beneficiaire = String(row.beneficiaire || "").toLowerCase();
            if (!motif.includes(needle) && !beneficiaire.includes(needle)) return false;
          } else {
            const uuid = String(row.uuid || "").toLowerCase();
            const receveur = String(row.receveur_nom || "").toLowerCase();
            if (!uuid.includes(needle) && !receveur.includes(needle)) return false;
          }
        }

        if (state.filters.dateStart || state.filters.dateEnd) {
          const targetDate = showDemandes
            ? row.created_at
            : mergeDateAndTime(row.date_reception, row.created_at);
          if (state.filters.dateStart && new Date(targetDate) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
          if (state.filters.dateEnd && new Date(targetDate) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
        }
        return true;
      });
      setFiltered(filtered);
    } else {
      setFiltered(data || []);
    }
  }, [data, state.filters, showDemandes]);

  const resetFilters = () => {
    const newState = { ...initialState, page: 1 };
    setState(newState);
    savePersistedState(storageKey, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const clearFilters = () => {
    clearPersistedState(storageKey);
    const newState = { ...initialState, page: 1 };
    setState(newState);
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...state.filters, [key]: value };
    const newState = { ...state, filters: newFilters, page: 1 }; // Reset page when filter changes
    setState(newState);
    savePersistedState(storageKey, { filters: newFilters, page: newState.page, pageSize: newState.pageSize });
  };

  const updatePagination = (page, pageSize) => {
    const newState = { ...state, page, pageSize };
    setState(newState);
    savePersistedState(storageKey, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return (filtered || []).slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  const canViewReceptionDetails = hasAnyPermission(["RECEPTION_LIST_SELF", "RECEPTION_LIST_ALL", "RECEPTION_LIST"]);
  const canViewDemandeDetails = hasAnyPermission([
    "DEMANDE_LIST",
    "DEMANDE_LIST_SELF",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
  ]);
  const canCreateReception = hasPermission("RECEPTION_CREATE");
  const canDownloadPdf = hasAnyPermission(["RECEPTION_LIST_SELF", "RECEPTION_LIST_ALL", "RECEPTION_LIST"]);
  const title =
    showDemandes ? "Demandes éligibles à réception"
      : modeKey === "pending" ? "Réceptions en attente"
        : modeKey === "done" ? "Réceptions effectuées"
          : "Réceptions";
  const emptyMessage =
    showDemandes ? "Aucune demande éligible."
      : modeKey === "pending" ? "Aucune réception en attente."
      : modeKey === "done" ? "Aucune réception effectuée."
        : "Aucune réception trouvée.";
  const referenceLabel = showDemandes ? "Recherche (motif / bénéficiaire)" : "Recherche (uuid / receveur)";
  const openCreate = (demande) => {
    setSelectedDemande(demande || null);
    setCreateOpen(true);
  };
  const closeCreate = () => {
    setCreateOpen(false);
    setSelectedDemande(null);
  };
  const exportColumnsDemandes = [
    { header: "UUID", key: "uuid" },
    { header: "Motif", key: "motif" },
    { header: "Statut", value: (d) => labelDemandeStatut(d.statut) },
    { header: "Bénéficiaire", value: (d) => d.beneficiaire || "-" },
    { header: "Montant", value: (d) => `${formatMoney(d.montant_net ?? d.montant)} FCFA` },
    { header: "Créé", value: (d) => formatDateTime(d.created_at) },
  ];
  const exportColumnsReceptions = [
    { header: "UUID", key: "uuid" },
    { header: "Receveur", value: (r) => r.receveur_nom || "-" },
    { header: "Date réception", value: (r) => formatDateTime(mergeDateAndTime(r.date_reception, r.created_at)) },
    { header: "Phase", value: (r) => formatPhase(r.phase) },
    { header: "Conforme", value: (r) => (r.conforme ? "Oui" : "Non") },
    { header: "Visa Directeur", value: (r) => (r.visa_directeur_id ? "Oui" : "Non") },
    { header: "Visa DAF", value: (r) => (r.visa_daf_requis === false ? "Non requis" : r.visa_daf_id ? "Oui" : "Non") },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    const rows = filtered;
    const columns = showDemandes ? exportColumnsDemandes : exportColumnsReceptions;
    const filename = showDemandes ? `demandes_receptions_${dateTag}.xlsx` : `receptions_${dateTag}.xlsx`;
    exportRowsToExcel({
      rows,
      columns,
      filename,
      sheetName: showDemandes ? "Demandes" : "Receptions",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        <div className="flex items-center gap-2">
          {canShowDemandes ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingView("receptions")}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  pendingView === "receptions"
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
                }`}
              >
                Réceptions à viser
              </button>
              <button
                type="button"
                onClick={() => setPendingView("demandes")}
                className={`px-3 py-2 text-sm rounded-lg border ${
                  pendingView === "demandes"
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
                }`}
              >
                Demandes éligibles
              </button>
            </div>
          ) : null}
          <ExportButton
            onExport={handleExport}
            disabled={!filtered.length}
            className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
          />
          <button
            onClick={fetch}
            disabled={loading}
            title="Actualiser"
            aria-label="Actualiser"
            className="inline-flex items-center justify-center p-2 rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">{referenceLabel}</label>
            <input
              type="text"
              value={state.filters.reference}
              onChange={(e) => updateFilter("reference", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Recherche..."
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Du</label>
            <DatePicker
              value={state.filters.dateStart ? new Date(state.filters.dateStart) : null}
              onChange={(d) => updateFilter("dateStart", d ? formatDate(d) : "")}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Au</label>
            <DatePicker
              value={state.filters.dateEnd ? new Date(state.filters.dateEnd) : null}
              onChange={(d) => updateFilter("dateEnd", d ? formatDate(d) : "")}
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Réinitialiser
          </button>
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Effacer filtres
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4">
          <Loader label="Chargement des données..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">{emptyMessage}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            {showDemandes ? (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motif</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Statut</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Bénéficiaire</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Créé</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">PJ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                {paged.map((demande) => (
                  <tr key={demande.id}>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{demande.uuid}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">{demande.motif}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${demandeStatusBadgeClass(demande.statut)}`}>
                          {labelDemandeStatut(demande.statut)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{demande.beneficiaire || "-"}</td>
                      <td className="px-4 py-3 text-sm">{formatMoney(demande.montant_net ?? demande.montant)} FCFA</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(demande.created_at)}</td>
                      <td className="px-3 py-3 text-center text-sm">
                        <DemandAttachmentsIndicator demande={demande} />
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {canCreateReception ? (
                            <button
                              type="button"
                              onClick={() => openCreate(demande)}
                              title="Créer réception"
                              aria-label="Créer réception"
                              className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-600 text-white hover:opacity-90"
                            >
                              <FiFilePlus />
                            </button>
                          ) : null}
                          {canViewDemandeDetails ? (
                            <Link
                              to={`/demandes/${demande.uuid}`}
                              title="Voir la demande"
                              aria-label="Voir la demande"
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                            >
                              <FiEye />
                            </Link>
                          ) : null}
                          {!canCreateReception && !canViewDemandeDetails ? "-" : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Receveur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Date réception</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Phase</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Conforme</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Visa Directeur</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Visa DAF</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                  {paged.map((reception) => {
                    const canDownloadRow = modeKey === "done" && isDoneForDaf(reception) && canDownloadPdf;
                    const showActions = canDownloadRow || canViewReceptionDetails;
                    return (
                    <tr key={reception.id}>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{reception.uuid}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{reception.receveur_nom}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {formatDateTime(mergeDateAndTime(reception.date_reception, reception.created_at))}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatPhase(reception.phase)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${
                          reception.conforme
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                        }`}>
                          {reception.conforme ? "Oui" : "Non"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reception.visa_directeur_id ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                              Oui
                            </span>
                            {reception.visa_directeur_delegated ? (
                              <span className="px-2 py-1 text-[10px] rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                                Délégué
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Non
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {reception.visa_daf_id ? (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                              Oui
                            </span>
                            {reception.visa_daf_delegated ? (
                              <span className="px-2 py-1 text-[10px] rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200">
                                Délégué
                              </span>
                            ) : null}
                          </div>
                        ) : reception.visa_daf_requis === false ? (
                          <span className="px-2 py-1 text-xs rounded bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                            Non requis
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                            Non
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {canDownloadRow ? (
                            <LoadingButton
                              type="button"
                              onClick={() =>
                                runDownload(`reception-${reception.uuid}`, () =>
                                  downloadFile(`/receptions/${reception.uuid}/pdf`, `reception_${reception.uuid}.pdf`)
                                )
                              }
                              loading={isDownloading(`reception-${reception.uuid}`)}
                              title="Télécharger PDF"
                              aria-label="Télécharger PDF"
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
                            >
                              {isDownloading(`reception-${reception.uuid}`) ? null : <FiDownload />}
                            </LoadingButton>
                          ) : null}
                          {canViewReceptionDetails ? (
                            <Link
                              to={`/receptions/${reception.uuid}`}
                              title="Voir"
                              aria-label="Voir"
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                            >
                              <FiEye />
                            </Link>
                          ) : null}
                          {!showActions ? "-" : null}
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Pagination
            page={state.page}
            pageSize={state.pageSize}
            total={total}
            onPageChange={(p) => updatePagination(p, state.pageSize)}
            onPageSizeChange={(size) => updatePagination(1, size)}
          />
          {showDemandes ? (
            <CreateReceptionModal
              open={createOpen}
              demande={selectedDemande}
              onClose={closeCreate}
              onCreated={() => {
                fetch();
              }}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
