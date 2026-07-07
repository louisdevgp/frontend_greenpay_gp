import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiRefreshCw } from "react-icons/fi";
import { listMyDemandes } from "../../services/demandes.services";
import CreateDemandeModal from "./CreateDemandeModal";
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
import DemandAttachmentsIndicator from "../../components/common/DemandAttachmentsIndicator";

const STORAGE_KEY = "filters:demandes:my";

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

const initialState = {
  filters: { statut: "", motif: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function DemandesMyList() {
  const { hasPermission, hasAnyPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY);
    return saved ? { ...initialState, ...saved } : initialState;
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page: state.page,
        pageSize: state.pageSize,
        ...(state.filters.statut ? { statut: state.filters.statut } : {}),
        ...(state.filters.motif ? { motif: state.filters.motif } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
      };

      const res = await listMyDemandes(params);
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
    if (state.filters.statut || state.filters.motif || state.filters.dateStart || state.filters.dateEnd) {
      const filtered = (data || []).filter((d) => {
        if (state.filters.statut && String(d.statut).toLowerCase() !== String(state.filters.statut).toLowerCase()) return false;
        if (state.filters.motif && !String(d.motif || "").toLowerCase().includes(String(state.filters.motif).toLowerCase())) return false;
        if (state.filters.dateStart && new Date(d.created_at) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
        if (state.filters.dateEnd && new Date(d.created_at) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
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

  const handleCreateSuccess = (newDemande) => {
    // Optionnel: Ajouter la nouvelle demande à la liste ou simplement rafraîchir
    fetch();
  };

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return (filtered || []).slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  const canCreate = hasAnyPermission(["DEMANDE_CREATE", "DEMANDE_CREATE_FOR_AGENT"]);
  const canViewDetails = hasAnyPermission([
    "DEMANDE_LIST",
    "DEMANDE_LIST_SELF",
    "VALIDATION_LIST_PENDING",
    "VALIDATION_LIST_DONE",
  ]);
  const exportColumns = [
    { header: "UUID", key: "uuid" },
    { header: "Motif", key: "motif" },
    { header: "Montant", value: (d) => `${formatMoney(d.montant_net ?? d.montant)} FCFA` },
    { header: "Statut", value: (d) => labelDemandeStatut(d.statut) },
    { header: "Créé", value: (d) => formatDateTime(d.created_at) },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: filtered,
      columns: exportColumns,
      filename: `mes_demandes_${dateTag}.xlsx`,
      sheetName: "Demandes",
    });
  };

  return (
    <div className="space-y-4">
      <CreateDemandeModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={handleCreateSuccess}
      />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Mes demandes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vue: Mes demandes (DEMANDEUR)</p>
        </div>
        <div className="flex gap-2">
          {canCreate ? (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
            >
              + Nouvelle demande
            </button>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous</option>
              <option value="a_modifier">À modifier</option>
              <option value="soumise">Soumise</option>
              <option value="validation_responsable">Validation Responsable</option>
              <option value="validation_directeur">Validation Directeur</option>
              <option value="validation_daf">Validation DAF</option>
              <option value="validation_dga">Validation DGA</option>
              <option value="validation_dg">Validation DG</option>
              <option value="approuvee">Approuvée</option>
              <option value="en_attente_paiement">En attente de paiement</option>
              <option value="achat_effectue">Achat effectue</option>
              <option value="paye">Payée</option>
              <option value="receptionnee">Réceptionnée</option>
              <option value="cloture">Clôturée</option>
              <option value="rejete">Rejetée</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Motif</label>
            <input
              type="text"
              value={state.filters.motif}
              onChange={(e) => updateFilter("motif", e.target.value)}
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
                    <td className="px-4 py-3 text-sm">{formatMoney(demande.montant_net ?? demande.montant)} FCFA</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs rounded ${demandeStatusBadgeClass(demande.statut)}`}>
                        {labelDemandeStatut(demande.statut)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(demande.created_at)}</td>
                    <td className="px-3 py-3 text-center text-sm">
                      <DemandAttachmentsIndicator demande={demande} />
                    </td>
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
