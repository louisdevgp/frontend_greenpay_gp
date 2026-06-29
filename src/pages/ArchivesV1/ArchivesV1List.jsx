import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiArchive, FiEye, FiPaperclip, FiRefreshCw } from "react-icons/fi";
import Loader from "../../components/common/Loader";
import Pagination from "../../components/common/Pagination";
import ExportButton from "../../components/common/ExportButton";
import DatePicker from "../../components/form/date-picker";
import { listArchivesV1Demandes, getArchivesV1Stats } from "../../services/archivesV1.service";
import { loadPersistedState, savePersistedState } from "../../utils/persistedFilters";
import { exportRowsToExcel } from "../../utils/excelExport";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { demandeStatusBadgeClass, labelDemandeStatut } from "../../utils/statusLabels";

const STORAGE_KEY = "filters:archives-v1:demandes";

const STATUS_OPTIONS = [
  "validation_section",
  "validation_entite",
  "validation_entite_finance",
  "validation_entite_generale",
  "approuve",
  "paye",
  "achat_effectue",
  "cloture",
  "rejete",
  "en_attente_paiement",
];

const initialState = {
  filters: {
    q: "",
    statut: "",
    beneficiaire: "",
    dateStart: "",
    dateEnd: "",
  },
  page: 1,
  pageSize: 10,
};

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function hasDocuments(row) {
  return (
    Number(row?.proformas_count || 0) +
      Number(row?.documents_paiement_count || 0) >
      0 || Boolean(row?.demande_physique_signee_url)
  );
}

export default function ArchivesV1List() {
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [state, setState] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY, initialState);
    return { ...initialState, ...saved, filters: { ...initialState.filters, ...(saved?.filters || {}) } };
  });

  const fetchRows = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        ...(state.filters.q ? { q: state.filters.q } : {}),
        ...(state.filters.statut ? { statut: state.filters.statut } : {}),
        ...(state.filters.beneficiaire ? { beneficiaire: state.filters.beneficiaire } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
      };
      const res = await listArchivesV1Demandes(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement archives V1");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setRows([]);
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await getArchivesV1Stats();
      setStats(res?.success ? res.data : null);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [state.filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const updateFilter = (key, value) => {
    const next = {
      ...state,
      page: 1,
      filters: { ...state.filters, [key]: value },
    };
    setState(next);
    savePersistedState(STORAGE_KEY, next);
  };

  const updatePagination = (page, pageSize) => {
    const next = { ...state, page, pageSize };
    setState(next);
    savePersistedState(STORAGE_KEY, next);
  };

  const resetFilters = () => {
    setState(initialState);
    savePersistedState(STORAGE_KEY, initialState);
  };

  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return rows.slice(start, start + state.pageSize);
  }, [rows, state.page, state.pageSize]);

  const exportColumns = [
    { header: "ID V1", key: "id" },
    { header: "Motif", key: "motif" },
    { header: "Beneficiaire", key: "beneficiaire" },
    { header: "Montant", value: (d) => `${formatMoney(d.montant)} FCFA` },
    { header: "Statut", value: (d) => labelDemandeStatut(d.statut) },
    { header: "Demandeur", key: "agent_nom" },
    { header: "Entite", key: "entite_nom" },
    { header: "Section", key: "section_nom" },
    { header: "Date creation", value: (d) => formatDateTime(d.date_creation) },
  ];

  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows,
      columns: exportColumns,
      filename: `archives_v1_demandes_${dateTag}.xlsx`,
      sheetName: "Archives V1",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <FiArchive />
            Lecture seule
          </div>
          <h1 className="mt-2 text-xl font-semibold text-gray-800 dark:text-white/90">Archives V1</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Consultation des anciennes demandes importees depuis la base V1.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            onExport={handleExport}
            disabled={!rows.length}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
          />
          <button
            type="button"
            onClick={() => {
              fetchRows();
              fetchStats();
            }}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-lg bg-gray-900 p-2 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
            title="Actualiser"
            aria-label="Actualiser"
          >
            <FiRefreshCw />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Demandes actives</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {statsLoading ? "-" : stats?.total ?? rows.length}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Avancees</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {statsLoading ? "-" : stats?.avancees ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Validation generale</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {statsLoading ? "-" : stats?.validation_generale ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-xs text-gray-500 dark:text-gray-400">Rejetees</div>
          <div className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {statsLoading ? "-" : stats?.rejetees ?? 0}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400">Recherche</label>
            <input
              type="text"
              value={state.filters.q}
              onChange={(e) => updateFilter("q", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none dark:border-gray-800 dark:bg-gray-950"
              placeholder="Motif, beneficiaire, demandeur..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none dark:border-gray-800 dark:bg-gray-950"
            >
              <option value="">Tous</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {labelDemandeStatut(s)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Beneficiaire</label>
            <input
              type="text"
              value={state.filters.beneficiaire}
              onChange={(e) => updateFilter("beneficiaire", e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none dark:border-gray-800 dark:bg-gray-950"
              placeholder="Beneficiaire"
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
        <button
          type="button"
          onClick={resetFilters}
          className="mt-3 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-950"
        >
          Reinitialiser
        </button>
      </div>

      {error ? (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="p-4">
          <Loader label="Chargement des archives..." />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
          Aucune demande V1 trouvee.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">ID V1</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Motif</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Beneficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Demandeur</th>
                  <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">PJ</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Creee</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {paged.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-white/90">#{row.id}</td>
                    <td className="max-w-sm truncate px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.motif || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.beneficiaire || "-"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-800 dark:text-white/90">{formatMoney(row.montant)} FCFA</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`whitespace-nowrap rounded px-2 py-1 text-xs ${demandeStatusBadgeClass(row.statut)}`}>
                        {labelDemandeStatut(row.statut)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{row.agent_nom || "-"}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      {hasDocuments(row) ? (
                        <span className="inline-flex items-center justify-center rounded-full bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          <FiPaperclip />
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(row.date_creation)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/archives-v1/demandes/${row.id}`}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                        title="Voir le detail"
                        aria-label="Voir le detail"
                      >
                        <FiEye />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={state.page}
            pageSize={state.pageSize}
            total={rows.length}
            onPageChange={(p) => updatePagination(p, state.pageSize)}
            onPageSizeChange={(size) => updatePagination(1, size)}
          />
        </>
      )}
    </div>
  );
}
