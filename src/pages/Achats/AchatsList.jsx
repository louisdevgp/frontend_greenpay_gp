import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiRefreshCw } from "react-icons/fi";
import { listAllDemandes } from "../../services/demandes.services";
import Pagination from "../../components/common/Pagination";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";
import DatePicker from "../../components/form/date-picker";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { exportRowsToExcel } from "../../utils/excelExport";
import { labelDemandeStatut, demandeStatusBadgeClass } from "../../utils/statusLabels";
import { useRealtime } from "../../context/RealtimeContext.tsx";

const MODE_STATUSES = {
  pending: ["en_attente_paiement", "paye", "payee"],
  done: ["achat_effectue", "receptionnee", "cloture", "cloturee"],
  all: ["en_attente_paiement", "paye", "payee", "achat_effectue", "receptionnee", "cloture", "cloturee"],
};

function normalizeMode(mode) {
  const key = String(mode || "all").trim().toLowerCase();
  if (key === "pending" || key === "done" || key === "all") return key;
  return "all";
}

function statusSetForMode(modeKey) {
  return new Set((MODE_STATUSES[modeKey] || MODE_STATUSES.all).map((s) => String(s).toLowerCase()));
}

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const initialState = {
  filters: { statut: "", beneficiaire: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function AchatsList({ mode = "all" }) {
  const { achatsTick } = useRealtime();
  const modeKey = useMemo(() => normalizeMode(mode), [mode]);
  const modeStatusSet = useMemo(() => statusSetForMode(modeKey), [modeKey]);
  const storageKey = useMemo(() => `filters:achats:${modeKey}`, [modeKey]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(storageKey);
    return saved ? { ...initialState, ...saved } : initialState;
  });

  useEffect(() => {
    const saved = loadPersistedState(storageKey);
    setState(saved ? { ...initialState, ...saved } : initialState);
  }, [storageKey]);

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const defaultStatuts = Array.from(modeStatusSet).join(",");
      const statutParam = state.filters.statut ? state.filters.statut : defaultStatuts;
      const params = {
        page: state.page,
        pageSize: state.pageSize,
        assigned_acheteur: 1,
        statut: statutParam,
        ...(state.filters.beneficiaire ? { beneficiaire: state.filters.beneficiaire } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
      };

      const res = await listAllDemandes(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement achats");
      const rows = (res.data || []).filter((d) => modeStatusSet.has(String(d?.statut || "").toLowerCase()));
      setData(rows);
      setFiltered(rows);
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
  }, [state.page, state.pageSize, state.filters, modeKey]);

  useEffect(() => {
    if (achatsTick > 0) fetch();
  }, [achatsTick]);

  useEffect(() => {
    if (state.filters.statut || state.filters.beneficiaire || state.filters.dateStart || state.filters.dateEnd) {
      const rows = (data || []).filter((d) => {
        if (state.filters.statut && String(d.statut).toLowerCase() !== String(state.filters.statut).toLowerCase()) return false;
        if (state.filters.beneficiaire && !String(d.beneficiaire || "").toLowerCase().includes(String(state.filters.beneficiaire).toLowerCase())) return false;
        if (state.filters.dateStart && new Date(d.created_at) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
        if (state.filters.dateEnd && new Date(d.created_at) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
        return true;
      });
      setFiltered(rows);
    } else {
      setFiltered(data || []);
    }
  }, [data, state.filters]);

  const resetFilters = () => {
    const newState = { ...initialState, page: 1 };
    setState(newState);
    savePersistedState(storageKey, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...state.filters, [key]: value };
    const newState = { ...state, filters: newFilters, page: 1 };
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

  const title =
    modeKey === "pending"
      ? "Achats en attente"
      : modeKey === "done"
        ? "Achats effectues"
        : "Mes achats";

  const emptyMessage =
    modeKey === "pending"
      ? "Aucun achat en attente."
      : modeKey === "done"
        ? "Aucun achat effectue."
        : "Aucun achat assigne.";

  const exportColumns = [
    { header: "UUID", key: "uuid" },
    { header: "Motif", key: "motif" },
    { header: "Montant", value: (d) => `${formatMoney(d.montant_net ?? d.montant)} FCFA` },
    { header: "Statut", value: (d) => labelDemandeStatut(d.statut) },
    { header: "Beneficiaire", value: (d) => d?.beneficiaire || "-" },
    { header: "Cree", value: (d) => formatDateTime(d.created_at) },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: filtered,
      columns: exportColumns,
      filename: `achats_${modeKey}_${dateTag}.xlsx`,
      sheetName: "Achats",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">{title}</h1>
        <div className="flex gap-2">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous</option>
              <option value="en_attente_paiement">En attente de paiement</option>
              <option value="paye">Payee</option>
              <option value="achat_effectue">Achat effectue</option>
              <option value="receptionnee">Receptionnee</option>
              <option value="cloture">Cloturee</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Beneficiaire</label>
            <input
              type="text"
              value={state.filters.beneficiaire}
              onChange={(e) => updateFilter("beneficiaire", e.target.value)}
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
            Reinitialiser
          </button>
          <button
            onClick={clearPersistedState.bind(null, storageKey)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Effacer filtres
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-4">
          <Loader label="Chargement des donnees..." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">{emptyMessage}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Motif</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Beneficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Cree</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                {paged.map((demande) => (
                  <tr key={demande.id}>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{demande.uuid}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">{demande.motif}</td>
                    <td className="px-4 py-3 text-sm">{formatMoney(demande.montant_net ?? demande.montant)} FCFA</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs rounded ${demandeStatusBadgeClass(demande.statut)}`}>
                        {labelDemandeStatut(demande.statut)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{demande.beneficiaire || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(demande.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/demandes/${demande.uuid}`}
                        title="Voir"
                        aria-label="Voir"
                        className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
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
            total={total}
            onPageChange={(p) => updatePagination(p, state.pageSize)}
            onPageSizeChange={(size) => updatePagination(1, size)}
          />
        </>
      )}
    </div>
  );
}

