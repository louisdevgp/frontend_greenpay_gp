import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiCheckCircle, FiCornerUpLeft, FiEye, FiRefreshCw, FiXCircle } from "react-icons/fi";
import { listValidationsPending } from "../../services/validations.service";
import ValidationActionModal from "./ValidationActionModal";
import Pagination from "../../components/common/Pagination";
import Loader from "../../components/common/Loader";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { labelValidationStepStatus } from "../../utils/statusLabels";
import { useAuth } from "../../context/AuthContext";
import { agentDisplayName } from "../../utils/validationActors";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";

const STORAGE_KEY = "filters:validations:pending";

function pickDemande(v) {
  if (!v) return null;
  return v.demande || v.demandes_paiement || v.demande_paiement || v.demandesPaiement || null;
}

const initialState = {
  filters: { statut: "", beneficiaire: "" },
  page: 1,
  pageSize: 10,
};

export default function ValidationsPending() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);

  const [state, setState] = useState(() => {
    const saved = loadPersistedState(STORAGE_KEY);
    return saved ? { ...initialState, ...saved } : initialState;
  });

  const [modal, setModal] = useState({ open: false, mode: "approve", item: null });

  const fetch = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listValidationsPending();
      if (!res?.success) throw new Error(res?.message || "Erreur chargement validations");
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
  }, []);

  useEffect(() => {
    if (state.filters.statut || state.filters.beneficiaire) {
      const filtered = (data || []).filter((v) => {
        const d = pickDemande(v);
        if (state.filters.statut && String(v?.status || "").toLowerCase() !== String(state.filters.statut).toLowerCase()) return false;
        if (state.filters.beneficiaire && !String(d?.beneficiaire || "").toLowerCase().includes(String(state.filters.beneficiaire).toLowerCase())) return false;
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
    // Gérer à la fois les événements DOM et les valeurs directes
    const actualValue = typeof value === 'object' && value?.target ? value.target.value : value;
    const newFilters = { ...state.filters, [key]: actualValue };
    const newState = { ...state, filters: newFilters, page: 1 }; // Reset page when filter changes
    setState(newState);
    savePersistedState(STORAGE_KEY, { filters: newFilters, page: newState.page, pageSize: newState.pageSize });
  };

  const updatePagination = (page, pageSize) => {
    const newState = { ...state, page, pageSize };
    setState(newState);
    savePersistedState(STORAGE_KEY, { filters: newState.filters, page: newState.page, pageSize: newState.pageSize });
  };

  const openModal = (mode, item) => {
    setModal({ open: true, mode, item });
  };

  const closeModal = () => {
    setModal({ open: false, mode: "approve", item: null });
    fetch(); // Refresh after action
  };

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return (filtered || []).slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  const canViewDetails = roles.includes("ADMIN") || roles.includes("DAF") || roles.includes("DGA") || roles.includes("DG");

  return (
    <div className="space-y-4">
      <ValidationActionModal
        open={modal.open}
        mode={modal.mode}
        item={modal.item}
        onClose={() => setModal({ open: false, mode: "approve", item: null })}
        onDone={closeModal}
      />

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Validations en attente</h1>
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

      {error ? (
        <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous</option>
              <option value="en_attente">En attente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Bénéficiaire</label>
            <input
              type="text"
              value={state.filters.beneficiaire}
              onChange={(e) => updateFilter("beneficiaire", e)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Recherche..."
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
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucune validation en attente.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">UUID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Rôle</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Demande</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Demandeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Créé</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                {paged.map((validation) => {
                  const demande = pickDemande(validation);
                  return (
                    <tr key={validation.id}>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-white/90">{validation?.uuid || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{validation?.role_name || "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        {demande ? (
                          <Link to={`/demandes/${demande.uuid}`} className="text-blue-600 hover:underline dark:text-blue-400">
                            {demande.motif?.substring(0, 30) + (demande.motif?.length > 30 ? "..." : "")}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3">{demande ? `${formatMoney(demande.montant_net ?? demande.montant)} FCFA` : "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${
                          validation.status === "en_attente"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                        }`}>
                          {labelValidationStepStatus(validation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        {agentDisplayName(demande?.agents_demandes_paiement_demandeur_idToagents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(validation.created_at)}</td>
                      <td className="px-4 py-3 text-sm space-x-2">
                        <button
                          onClick={() => openModal("approve", validation)}
                          title="Valider"
                          aria-label="Valider"
                          className="inline-flex items-center justify-center p-2 rounded bg-green-600 text-white hover:opacity-90"
                        >
                          <FiCheckCircle />
                        </button>
                        <button
                          onClick={() => openModal("reject", validation)}
                          title="Rejeter"
                          aria-label="Rejeter"
                          className="inline-flex items-center justify-center p-2 rounded bg-red-600 text-white hover:opacity-90"
                        >
                          <FiXCircle />
                        </button>
                        <button
                          onClick={() => openModal("return", validation)}
                          title="Retourner"
                          aria-label="Retourner"
                          className="inline-flex items-center justify-center p-2 rounded bg-amber-600 text-white hover:opacity-90"
                        >
                          <FiCornerUpLeft />
                        </button>
                        {canViewDetails ? (
                          <Link
                            to={`/validations/${validation.uuid}`}
                            title="Voir"
                            aria-label="Voir"
                            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                          >
                            <FiEye />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
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
