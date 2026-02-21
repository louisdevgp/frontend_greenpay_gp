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
import { useAuth } from "../../context/AuthContext";
import { labelDemandeStatut, demandeStatusBadgeClass } from "../../utils/statusLabels";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { exportRowsToExcel } from "../../utils/excelExport";

const STORAGE_KEY = "filters:demandes:all";
const ROLE_VIEWS = {
  GLOBAL: "GLOBAL",
  RESPONSABLE: "RESPONSABLE",
  DEMANDEUR: "DEMANDEUR",
};

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const initialState = {
  filters: { statut: "", beneficiaire: "", dateStart: "", dateEnd: "", roleView: "" },
  page: 1,
  pageSize: 10,
};

function normalizeRole(r) {
  return String(r || "").trim().toUpperCase();
}

function hasAnyRole(roles, list) {
  const set = new Set((roles || []).map(normalizeRole));
  return list.some((r) => set.has(normalizeRole(r)));
}

function getAllowedRoleViews(roles = []) {
  if (hasAnyRole(roles, ["ADMIN", "DG", "DGA", "DAF", "COMPTABLE", "CAISSE"])) {
    return [ROLE_VIEWS.GLOBAL];
  }

  if (hasAnyRole(roles, ["RESPONSABLE", "DIRECTEUR", "ASSISTANTE_TECHNIQUE"])) {
    return [ROLE_VIEWS.RESPONSABLE];
  }

  return [ROLE_VIEWS.DEMANDEUR];
}

function getDefaultRoleView(roles = []) {
  if (hasAnyRole(roles, ["ADMIN", "DG", "DGA", "DAF", "COMPTABLE", "CAISSE"])) return ROLE_VIEWS.GLOBAL;
  if (hasAnyRole(roles, ["RESPONSABLE", "DIRECTEUR", "ASSISTANTE_TECHNIQUE"])) return ROLE_VIEWS.RESPONSABLE;
  return ROLE_VIEWS.DEMANDEUR;
}

function getRoleViewLabel(roleView, roles = []) {
  if (roleView === ROLE_VIEWS.DEMANDEUR) return "Mes demandes";
  if (roleView === ROLE_VIEWS.GLOBAL) return "Toutes les directions";
  if (roleView === ROLE_VIEWS.RESPONSABLE) {
    if (hasAnyRole(roles, ["ASSISTANTE_TECHNIQUE"])) return "Direction (assistante technique)";
    if (hasAnyRole(roles, ["DIRECTEUR"])) return "Direction (directeur)";
    if (hasAnyRole(roles, ["RESPONSABLE"])) return "Direction (responsable)";
    return "Ma direction";
  }
  return "Vue personnalisée";
}

export default function DemandesAllList() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const allowedRoleViews = useMemo(() => getAllowedRoleViews(roles), [roles]);
  const defaultRoleView = useMemo(() => getDefaultRoleView(roles), [roles]);
  const showRoleView = allowedRoleViews.length > 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY);
    const next = saved ? { ...initialState, ...saved } : initialState;
    const initialRoleView = next.filters.roleView || defaultRoleView;
    const roleViewFinal = allowedRoleViews.includes(initialRoleView) ? initialRoleView : defaultRoleView;
    return { ...next, filters: { ...next.filters, roleView: roleViewFinal } };
  });

  useEffect(() => {
    if (!allowedRoleViews.includes(state.filters.roleView)) {
      const roleViewFinal = allowedRoleViews.includes(defaultRoleView) ? defaultRoleView : allowedRoleViews[0] || "";
      const newState = { ...state, filters: { ...state.filters, roleView: roleViewFinal } };
      setState(newState);
      savePersistedState(STORAGE_KEY, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
    }
  }, [allowedRoleViews, defaultRoleView, state.filters.roleView]);

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: state.page,
        pageSize: state.pageSize,
        ...(state.filters.statut ? { statut: state.filters.statut } : {}),
        ...(state.filters.beneficiaire ? { beneficiaire: state.filters.beneficiaire } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
        ...(state.filters.roleView ? { roleView: state.filters.roleView } : {}),
      };

      const res = await listAllDemandes(params);
      if (!res?.success) throw new Error(res?.message || "Erreur chargement demandes");
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
    if (state.filters.statut || state.filters.beneficiaire || state.filters.dateStart || state.filters.dateEnd || state.filters.roleView) {
      const filtered = (data || []).filter((d) => {
        if (state.filters.statut && String(d.statut).toLowerCase() !== String(state.filters.statut).toLowerCase()) return false;
        if (state.filters.beneficiaire && !String(d.beneficiaire || "").toLowerCase().includes(String(state.filters.beneficiaire).toLowerCase())) return false;
        if (state.filters.dateStart && new Date(d.created_at) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
        if (state.filters.dateEnd && new Date(d.created_at) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
        // Note: Le filtre roleView est appliqué côté backend, donc on ne le filtre pas ici côté frontend
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

  const canViewDetails = true;
  const exportColumns = [
    { header: "UUID", key: "uuid" },
    { header: "Motif", key: "motif" },
    { header: "Montant", value: (d) => `${formatMoney(d.montant_net ?? d.montant)} FCFA` },
    { header: "Statut", value: (d) => labelDemandeStatut(d.statut) },
    { header: "Bénéficiaire", key: "beneficiaire" },
    { header: "Créé", value: (d) => formatDateTime(d.created_at) },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: filtered,
      columns: exportColumns,
      filename: `demandes_${dateTag}.xlsx`,
      sheetName: "Demandes",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Toutes les demandes</h1>
          {showRoleView && state.filters.roleView && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Vue: {getRoleViewLabel(state.filters.roleView, roles)}
            </p>
          )}
        </div>
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
        <div className={`grid grid-cols-1 gap-3 ${showRoleView ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {showRoleView ? (
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400">Vue</label>
              <select
                value={state.filters.roleView}
                onChange={(e) => updateFilter("roleView", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                {allowedRoleViews.includes(ROLE_VIEWS.GLOBAL) ? (
                  <option value={ROLE_VIEWS.GLOBAL}>Vue globale</option>
                ) : null}
                {allowedRoleViews.includes(ROLE_VIEWS.RESPONSABLE) ? (
                  <option value={ROLE_VIEWS.RESPONSABLE}>Ma direction</option>
                ) : null}
                {allowedRoleViews.includes(ROLE_VIEWS.DEMANDEUR) ? (
                  <option value={ROLE_VIEWS.DEMANDEUR}>Mes demandes</option>
                ) : null}
              </select>
            </div>
          ) : null}

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous</option>
              <option value="draft">Brouillon</option>
              <option value="approuvee">Approuvée</option>
              <option value="rejete">Rejetée</option>
              <option value="a_modifier">À modifier</option>
              <option value="en_cours_validation">En cours de validation</option>
            </select>
          </div>

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
            onClick={clearPersistedState.bind(null, STORAGE_KEY)}
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
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucune demande trouvée.</div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Bénéficiaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Créé</th>
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
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{demande.beneficiaire}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(demande.created_at)}</td>
                    <td className="px-4 py-3 text-sm">
                      {canViewDetails ? (
                        <Link
                          to={`/demandes/${demande.uuid}`}
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
