import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listValidationsDone } from "../../services/validations.service";
import Pagination from "../../components/common/Pagination";
import DatePicker from "../../components/form/date-picker";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import { labelValidationStepStatus } from "../../utils/statusLabels";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";

const STORAGE_KEY = "filters:validations:done";

function EyeIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}
function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function pickDemande(v) {
  return v?.demande || v?.demandes_paiement || v?.demande_paiement || v?.demandesPaiement || null;
}

const initialState = {
  filters: { statut: "", beneficiaire: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function ValidationsDone() {
  const persisted = useMemo(() => loadPersistedState(STORAGE_KEY, initialState), []);
  const [filters, setFilters] = useState(persisted.filters);
  const [page, setPage] = useState(persisted.page);
  const [pageSize, setPageSize] = useState(persisted.pageSize);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    savePersistedState(STORAGE_KEY, { filters, page, pageSize });
  }, [filters, page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listValidationsDone();
      if (!res?.success) throw new Error(res?.message || "Erreur chargement validations");
      setRows(res.data || []);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    return (rows || []).filter((v) => {
      const d = pickDemande(v);
      const statut = String(d?.statut || v?.statut || "");
      const benef = String(d?.beneficiaire || "");
      const createdAt = v?.created_at || v?.validated_at || d?.created_at;

      const okStatut = !filters.statut || statut.toLowerCase().includes(filters.statut.toLowerCase());
      const okBenef = !filters.beneficiaire || benef.toLowerCase().includes(filters.beneficiaire.toLowerCase());

      const created = createdAt ? new Date(createdAt) : null;
      const start = parseDateOnlyStart(filters.dateStart);
      const end = parseDateOnlyEnd(filters.dateEnd);

      const okStart = !start || (created && created >= start);
      const okEnd = !end || (created && created <= end);

      return okStatut && okBenef && okStart && okEnd;
    });
  }, [rows, filters]);

  useEffect(() => {
    setPage(1);
  }, [filters.statut, filters.beneficiaire, filters.dateStart, filters.dateEnd]);

  const total = filtered.length;
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const resetFilters = () => {
    setFilters(initialState.filters);
    setPage(1);
    setPageSize(initialState.pageSize);
    clearPersistedState(STORAGE_KEY);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Historique validations</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Validations terminées (validées/rejetées).</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Rafraîchir
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Reset filtres
          </button>
        </div>
      </div>

      {/* filtres */}
      <div className="grid grid-cols-1 gap-3 p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800 sm:grid-cols-4">
        <input
          value={filters.beneficiaire}
          onChange={(e) => setFilters((p) => ({ ...p, beneficiaire: e.target.value }))}
          placeholder="Filtrer bénéficiaire"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
        />
        <input
          value={filters.statut}
          onChange={(e) => setFilters((p) => ({ ...p, statut: e.target.value }))}
          placeholder="Filtrer statut"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
        />
        <DatePicker
          id="validations-done-start"
          placeholder="Date début"
          defaultDate={filters.dateStart || undefined}
          onChange={(_, dateStr) => setFilters((p) => ({ ...p, dateStart: dateStr }))}
        />
        <DatePicker
          id="validations-done-end"
          placeholder="Date fin"
          defaultDate={filters.dateEnd || undefined}
          onChange={(_, dateStr) => setFilters((p) => ({ ...p, dateEnd: dateStr }))}
        />
      </div>

      {/* table */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left bg-gray-50 dark:bg-gray-950">
              <tr>
                <th className="px-4 py-3">Demande</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Résultat</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={6}>Chargement...</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-4 text-red-600 dark:text-red-400" colSpan={6}>{error}</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={6}>Aucun historique.</td></tr>
              ) : (
                paginated.map((v) => {
                  const d = pickDemande(v);
                  const demandeUuid = d?.uuid || v?.demande_uuid || v?.demandeUuid;
                  const uuid = v?.uuid || v?.validation_uuid || v?.validationUuid;
                  const status = labelValidationStepStatus(v?.status);
                  const date = v?.validated_at || v?.updated_at || v?.created_at || d?.updated_at;

                  return (
                    <tr key={v.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3 font-mono text-xs">{demandeUuid || "-"}</td>
                      <td className="px-4 py-3">{d?.beneficiaire || "-"}</td>
                      <td className="px-4 py-3">{formatMoney(d?.montant)} FCFA</td>
                      <td className="px-4 py-3">{status}</td>
                      <td className="px-4 py-3">{formatDate(date)}</td>
                      <td className="px-4 py-3 text-right">
                        {uuid ? (
                          <Link
                            to={`/validations/uuid/${uuid}`}
                            className="inline-flex p-2 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                            title="Voir"
                          >
                            <EyeIcon />
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </div>
      </div>
    </div>
  );
}
