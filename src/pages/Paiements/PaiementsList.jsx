import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPaiements } from "../../services/paiements.service";
import Pagination from "../../components/common/Pagination";
import { loadPersistedState, clearPersistedState, savePersistedState} from "../../utils/persistedFilters";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import DatePicker from "../../components/form/date-picker";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";

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

const LS_KEY = "filters:paiements:list";

export default function PaiementsList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const [filters, setFilters] = useState(() =>
    loadPersistedState(LS_KEY, { moyen: "", type: "", demande_uuid: "", dateStart: "", dateEnd: "" })
  );

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listPaiements();
      if (!res?.success) throw new Error(res?.message || "Erreur chargement paiements");
      setRows(res.data || []);
    } catch (e) {
      setError(e?.message || "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { savePersistedState(LS_KEY, filters); setPage(1); }, [filters]);

  const filtered = useMemo(() => {
    return (rows || []).filter((p) => {
      const moyen = String(p?.moyen_paiement || "");
      const type = String(p?.type_paiement || "");
      const demandeUuid = String(p?.demandes_paiement?.uuid || p?.demande_uuid || "");
      const createdAt = p?.created_at || p?.date_paiement;

      const okMoyen = !filters.moyen || moyen.toLowerCase().includes(filters.moyen.toLowerCase());
      const okType = !filters.type || type.toLowerCase().includes(filters.type.toLowerCase());
      const okDemande = !filters.demande_uuid || demandeUuid.toLowerCase().includes(filters.demande_uuid.toLowerCase());

      const d = createdAt ? new Date(createdAt) : null;
      const start = parseDateOnlyStart(filters.dateStart);
      const end = parseDateOnlyEnd(filters.dateEnd);
      const okStart = !start || (d && d >= start);
      const okEnd = !end || (d && d <= end);

      return okMoyen && okType && okDemande && okStart && okEnd;
    });
  }, [rows, filters]);

  const total = filtered.length;
  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  return (
    <div className="space-y-4">
      <FullscreenLoader show={loading} label="Chargement des paiements..." />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Paiements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Liste des paiements + documents.</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={fetchData}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Rafraîchir
          </button>

          <button
            type="button"
            onClick={() => { clearPersistedState(LS_KEY); setFilters({ moyen: "", type: "", demande_uuid: "", dateStart: "", dateEnd: "" }); }}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Reset filtres
          </button>
        </div>
      </div>

      {/* filtres */}
      <div className="grid grid-cols-1 gap-3 p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800 sm:grid-cols-5">
        <input
          value={filters.demande_uuid}
          onChange={(e) => setFilters((p) => ({ ...p, demande_uuid: e.target.value }))}
          placeholder="Filtrer demande uuid"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
        />
        <input
          value={filters.moyen}
          onChange={(e) => setFilters((p) => ({ ...p, moyen: e.target.value }))}
          placeholder="Filtrer moyen"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
        />
        <input
          value={filters.type}
          onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}
          placeholder="Filtrer type"
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
        />
        <DatePicker
          id="paiements-start"
          placeholder="Date début"
          defaultDate={filters.dateStart || undefined}
          onChange={(_, dateStr) => setFilters((p) => ({ ...p, dateStart: dateStr }))}
        />
        <DatePicker
          id="paiements-end"
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
                <th className="px-4 py-3">UUID</th>
                <th className="px-4 py-3">Demande</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Moyen</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {error ? (
                <tr><td className="px-4 py-4 text-red-600 dark:text-red-400" colSpan={7}>{error}</td></tr>
              ) : paged.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={7}>Aucun paiement.</td></tr>
              ) : (
                paged.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-mono text-xs">{p.uuid}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p?.demandes_paiement?.uuid || p.demande_uuid || "-"}</td>
                    <td className="px-4 py-3">{p.type_paiement}</td>
                    <td className="px-4 py-3">{formatMoney(p.montant)} FCFA</td>
                    <td className="px-4 py-3">{p.moyen_paiement}</td>
                    <td className="px-4 py-3">{formatDate(p.date_paiement || p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/paiements/${p.uuid}`}
                        className="inline-flex p-2 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                        title="Voir"
                      >
                        <EyeIcon />
                      </Link>
                    </td>
                  </tr>
                ))
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
