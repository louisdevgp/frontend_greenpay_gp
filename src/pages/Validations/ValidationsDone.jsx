import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiEye, FiRefreshCw, FiX } from "react-icons/fi";
import { cancelValidation, listValidationsDone } from "../../services/validations.service";
import Pagination from "../../components/common/Pagination";
import Loader from "../../components/common/Loader";
import DatePicker from "../../components/form/date-picker";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { labelValidationStepStatus } from "../../utils/statusLabels";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";
import { useAuth } from "../../context/AuthContext";
import { validationActorLabel, isDelegatedValidation } from "../../utils/validationActors";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import { emitToast } from "../../services/toastBus";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";
import ExportButton from "../../components/common/ExportButton";
import { exportRowsToExcel } from "../../utils/excelExport";
import { useRealtime } from "../../context/RealtimeContext.tsx";

const STORAGE_KEY = "filters:validations:done";

function formatDate(input) {
  if (!input) return "";
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function pickDemande(v) {
  if (!v) return null;
  return v.demande || v.demandes_paiement || v.demande_paiement || v.demandesPaiement || null;
}

function ActorLabel({ validation }) {
  const actor = validationActorLabel(validation);
  const primaryRaw = actor?.primary || "-";
  const primary = primaryRaw && primaryRaw !== "-" ? primaryRaw : "Moi";
  const secondary = actor?.secondary;
  const delegated = isDelegatedValidation(validation);

  return (
    <div>
      <div>{primary}</div>
      {secondary ? <div className="text-xs text-gray-500 dark:text-gray-400">{secondary}</div> : null}
      {delegated ? <div className="text-[11px] text-emerald-600 dark:text-emerald-300">Délégué</div> : null}
    </div>
  );
}

const initialState = {
  filters: { statut: "", beneficiaire: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function ValidationsDone() {
  const { hasPermission } = useAuth();
  const { validationsTick } = useRealtime();
  const canCancel = hasPermission("VALIDATION_CANCEL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelComment, setCancelComment] = useState("");

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
        ...(state.filters.statut ? { statut: state.filters.statut } : {}),
        ...(state.filters.beneficiaire ? { beneficiaire: state.filters.beneficiaire } : {}),
        ...(state.filters.dateStart ? { dateStart: state.filters.dateStart } : {}),
        ...(state.filters.dateEnd ? { dateEnd: state.filters.dateEnd } : {}),
      };

      const res = await listValidationsDone(params);
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
  }, [state.page, state.pageSize, state.filters]);
  useEffect(() => {
    if (validationsTick > 0) fetch();
  }, [validationsTick]);

  useEffect(() => {
    if (state.filters.statut || state.filters.beneficiaire || state.filters.dateStart || state.filters.dateEnd) {
      const filtered = (data || []).filter((v) => {
        const d = pickDemande(v);
        if (state.filters.statut && String(v?.status || "").toLowerCase() !== String(state.filters.statut).toLowerCase()) return false;
        if (state.filters.beneficiaire && !String(d?.beneficiaire || "").toLowerCase().includes(String(state.filters.beneficiaire).toLowerCase())) return false;
        if (state.filters.dateStart && v?.validated_at && new Date(v.validated_at) < new Date(parseDateOnlyStart(state.filters.dateStart))) return false;
        if (state.filters.dateEnd && v?.validated_at && new Date(v.validated_at) > new Date(parseDateOnlyEnd(state.filters.dateEnd))) return false;
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
    // Si value est une chaîne, c'est probablement un événement de champ de formulaire
    // Si c'est autre chose, on suppose que c'est la valeur directe
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

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (state.page - 1) * state.pageSize;
    return (filtered || []).slice(start, start + state.pageSize);
  }, [filtered, state.page, state.pageSize]);

  const canViewDetails = hasPermission("VALIDATION_GET");
  const exportColumns = [
    { header: "UUID", value: (v) => v?.uuid || "-" },
    { header: "Rôle", value: (v) => v?.role_name || "-" },
    { header: "Demande", value: (v) => pickDemande(v)?.motif || "-" },
    {
      header: "Montant",
      value: (v) => {
        const d = pickDemande(v);
        return d ? `${formatMoney(d.montant_net ?? d.montant)} FCFA` : "-";
      },
    },
    { header: "Statut", value: (v) => labelValidationStepStatus(v?.status) },
    {
      header: "Validé par",
      value: (v) => {
        const actor = validationActorLabel(v);
        const primaryRaw = actor?.primary || "-";
        const primary = primaryRaw && primaryRaw !== "-" ? primaryRaw : "Moi";
        const secondary = actor?.secondary;
        return secondary ? `${primary} (${secondary})` : primary;
      },
    },
    { header: "Date", value: (v) => formatDateTime(v?.validated_at) },
    { header: "Commentaire", value: (v) => v?.commentaire || "-" },
  ];
  const handleExport = () => {
    const dateTag = new Date().toISOString().slice(0, 10);
    exportRowsToExcel({
      rows: filtered,
      columns: exportColumns,
      filename: `validations_traitees_${dateTag}.xlsx`,
      sheetName: "Validations",
    });
  };

  const openCancel = (validation) => {
    setCancelComment("");
    const stepId = validation?.step_id ?? validation?.id;
    setCancelTarget({ ...validation, step_id: stepId });
  };

  const closeCancel = () => {
    if (cancelLoading) return;
    setCancelTarget(null);
    setCancelComment("");
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    const commentaire = String(cancelComment || "").trim();
    if (!commentaire) {
      emitToast("Commentaire obligatoire", "error");
      return;
    }
    setCancelLoading(true);
    try {
      const stepId = cancelTarget?.step_id ?? cancelTarget?.id;
      const res = await cancelValidation(stepId, { commentaire });
      if (!res?.success) throw new Error(res?.message || "Annulation impossible");
      emitToast("Validation annulée", "success");
      closeCancel();
      await fetch();
    } catch (e) {
      emitToast(e?.message || "Erreur d'annulation", "error");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Validations traitées</h1>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400">Statut</label>
            <select
              value={state.filters.statut}
              onChange={(e) => updateFilter("statut", e)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            >
              <option value="">Tous</option>
              <option value="valide">Validé</option>
              <option value="rejete">Rejeté</option>
              <option value="annulee">Annulée</option>
              <option value="retour_modification">Retournée (modification)</option>
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
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">Aucune validation trouvée.</div>
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Validé par</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Commentaire</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-800">
                {paged.map((validation, index) => {
                  const demande = pickDemande(validation);
                  const demandeStatusKey = String(demande?.statut || "").toLowerCase();
                  const isPaidDemande = [
                    "paye",
                    "payee",
                    "en_attente_paiement",
                    "receptionnee",
                    "cloture",
                    "cloturee",
                  ].includes(demandeStatusKey);
                  const statusKey = String(validation?.status || "").toLowerCase();
                  const statusClass =
                    statusKey === "valide"
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                      : statusKey === "rejete" || statusKey === "rejetee"
                        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                        : statusKey === "retour_modification"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                          : statusKey === "annulee" || statusKey === "annule"
                            ? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
                  const canCancelRow = !isPaidDemande && canCancel && validation?.can_cancel === true;
                  const rowKey =
                    validation?.audit_id ?? validation?.id ?? validation?.uuid ?? `${validation?.step_id ?? "row"}-${index}`;
                  return (
                    <tr key={rowKey}>
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
                      <td className="px-4 py-3 text-sm">{demande ? `${formatMoney(demande.montant_net ?? demande.montant)} FCFA` : "-"}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 text-xs rounded ${statusClass}`}>
                          {labelValidationStepStatus(validation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                        <ActorLabel validation={validation} />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{formatDateTime(validation.validated_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-xs">
                        {validation?.commentaire || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {canViewDetails && validation?.uuid ? (
                            <Link
                              to={`/validations/${validation.uuid}`}
                              title="Voir"
                              aria-label="Voir"
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950"
                            >
                              <FiEye />
                            </Link>
                          ) : null}
                          {canCancelRow ? (
                            <button
                              type="button"
                              title="Annuler la validation"
                              aria-label="Annuler la validation"
                              onClick={() => openCancel(validation)}
                              className="inline-flex items-center justify-center p-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950"
                            >
                              <FiX />
                            </button>
                          ) : null}
                          {!canViewDetails && !canCancelRow ? "-" : null}
                        </div>
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

      <ConfirmActionModal
        open={!!cancelTarget}
        title="Annuler la validation"
        message="Cette action n'est possible que si aucune validation supérieure n'a été effectuée. Commentaire obligatoire."
        confirmLabel="Annuler"
        cancelLabel="Fermer"
        confirmVariant="danger"
        loading={cancelLoading}
        onClose={closeCancel}
        onConfirm={confirmCancel}
        showComment
        commentLabel="Commentaire"
        commentPlaceholder="Précisez la raison de l'annulation"
        commentValue={cancelComment}
        onCommentChange={(e) => setCancelComment(e.target.value)}
        commentRequired
        confirmDisabled={!String(cancelComment || "").trim()}
      />
    </div>
  );
}
