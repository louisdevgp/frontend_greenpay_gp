import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiRefreshCw } from "react-icons/fi";
import { listPaiements } from "../../services/paiements.service";
import Pagination from "../../components/common/Pagination";
import Loader from "../../components/common/Loader";
import ExportButton from "../../components/common/ExportButton";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";
import DatePicker from "../../components/form/date-picker";
import { useAuth } from "../../context/AuthContext";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { exportRowsToExcel } from "../../utils/excelExport";
import { useRealtime } from "../../context/RealtimeContext.tsx";

const STORAGE_KEY = "filters:paiements:list";

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function paiementBeneficiaire(paiement) {
  return paiement?.beneficiaire || paiement?.demandes_paiement?.beneficiaire || "-";
}

const initialState = {
  filters: { beneficiaire: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function PaiementsList() {
  const { hasPermission } = useAuth();
  const { paiementsTick } = useRealtime();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY);
    return saved ? { ...initialState, ...saved } : initialState;
  });

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: state.page,
        pageSize: state.pageSize,
        ...(state.filters.beneficiaire ? { beneficiaire: state.filters.beneficiaire } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
      };

      const res = await listPaiements(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement paiements");
      setData(res.data || []);
      setFiltered(res.data || []);
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
  }, [state.page, state.pageSize, state.filters]);

  useEffect(() => {
    if (paiementsTick > 0) fetch();
  }, [paiementsTick]);

  useEffect(() => {
    if (state.filters.beneficiaire || state.filters.dateStart || state.filters.dateEnd) {
      const filtered = (data || []).filter((p) => {
        if (state.filters.beneficiaire && !String(paiementBeneficiaire(p)).toLowerCase().includes(String(state.filters.beneficiaire).toLowerCase()))
          return false;
        if (state.filters.dateStart && new Date(p.created_at) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
        if (state.filters.dateEnd && new Date(p.created_at) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
        return true;
      });
      setFiltered(filtered);
    } else {
      setFiltered(data || []);
    }
  }, [data, state.filters]);

  const resetFilters = () => {
    const newState = { ...initialState, page: 1 };
    setState(newState);
    savePersistedState(STORAGE_KEY, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const clearFilters = () => {
    clearPersistedState(STORAGE_KEY);
    const newState = { ...initialState, page: 1 };
    setState(newState);
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...state.filters, [key]: value };
    const newState = { ...state, filters: newFilters, page: 1 }; // Reset page when filter changes
    setState(newState);
    savePersistedState(STORAGE_KEY, { filters: newFilters, page: newState.page, pageSize: newState.pageSize });
  };

  const updatePagination = (page, pageSize) => {
    const newState = { ...state, page, pageSize };
    setState(newState);
    savePersistedState(STORAGE_KEY, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return (filtered || []).slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  const canViewDetails = hasPermission("PAIEMENT_GET");
  const exportColumns = [
    { header: "UUID", key: "uuid" },
    { header: "Type", value: (p) => p?.type_paiement || "-" },
    { header: "Moyen", value: (p) => p?.moyen_paiement || "-" },
    { header: "Montant", value: (p) => `${formatMoney(p?.montant)} FCFA` },
    { header: "Bénéficiaire", value: (p) => paiementBeneficiaire(p) },
    { header: "Créé", value: (p) => formatDateTime(p?.created_at) },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: filtered,
      columns: exportColumns,
      filename: `paiements_${dateTag}.xlsx`,
      sheetName: "Paiements",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Paiements effectués</h1>
        <div className="flex items-center gap-2">
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
            <label className="block text-xs text-gray-500 dark:text-gray-400">Bénéficiaire</label>
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
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucun paiement trouvé.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Moyen</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Bénéficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Créé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                {paged.map((paiement) => (
                  <tr key={paiement.id}>
                    <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{paiement.uuid}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{paiement.type_paiement}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{paiement.moyen_paiement || "-"}</td>
                    <td className="px-4 py-3 text-sm">{formatMoney(paiement.montant)} FCFA</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{paiementBeneficiaire(paiement)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(paiement.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {canViewDetails ? (
                        <Link
                          to={`/paiements/${paiement.uuid}`}
                          title="Voir"
                          aria-label="Voir"
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                        >
                          <FiEye />
                        </Link>
                      ) : (
                        "-"
                      )}
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
