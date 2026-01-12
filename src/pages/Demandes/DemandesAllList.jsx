import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAllDemandes } from "../../services/demandes.services";
import { useAuth } from "../../context/AuthContext";
import CreatePaiementModal from "../Paiements/CreatePaiementModal";
import Pagination from "../../components/common/Pagination";
import { loadPersistedState, savePersistedState, clearPersistedState } from "../../utils/persistedFilters";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import LoadingButton from "../../components/common/LoadingButton";
import { labelDemandeStatut } from "../../utils/statusLabels";
import DatePicker from "../../components/form/date-picker";
import { parseDateOnlyEnd, parseDateOnlyStart } from "../../utils/dateRange";

const STORAGE_KEY = "filters:demandes:all";

function EyeIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function MoneyIcon({ className = "w-5 h-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M21 7H3v10h18V7Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 12h.01M17 12h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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

const initialState = {
  filters: { statut: "", beneficiaire: "", dateStart: "", dateEnd: "" },
  page: 1,
  pageSize: 10,
};

export default function DemandesAllList() {
  const { user } = useAuth();
  const roles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const canPay = roles.includes("DAF") || roles.includes("COMPTABLE") || roles.includes("ADMIN");

  const persisted = useMemo(() => loadPersistedState(STORAGE_KEY, initialState), []);
  const [filters, setFilters] = useState(persisted.filters);
  const [page, setPage] = useState(persisted.page);
  const [pageSize, setPageSize] = useState(persisted.pageSize);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);

  const [payOpen, setPayOpen] = useState(false);
  const [selectedDemande, setSelectedDemande] = useState(null);

  useEffect(() => {
    savePersistedState(STORAGE_KEY, { filters, page, pageSize });
  }, [filters, page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await listAllDemandes();
      if (!res?.success) throw new Error(res?.message || "Erreur chargement demandes");
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

  const canPayThisDemande = (d) => {
    const s = String(d?.statut || "").toLowerCase();
    return canPay && (s === "approuvee" || s === "en_attente_paiement");
  };

  const filtered = useMemo(() => {
    return (rows || []).filter((d) => {
      const statut = String(d?.statut || "");
      const benef = String(d?.beneficiaire || "");
      const okStatut = !filters.statut || statut.toLowerCase().includes(filters.statut.toLowerCase());
      const okBenef = !filters.beneficiaire || benef.toLowerCase().includes(filters.beneficiaire.toLowerCase());

      const created = d?.created_at ? new Date(d.created_at) : null;
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
      <FullscreenLoader show={loading} label="Chargement des demandes..." />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Demandes</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Liste et actions (voir / payer).</p>
        </div>

        <div className="flex items-center gap-2">
          <LoadingButton
            type="button"
            loading={loading}
            onClick={fetchData}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Rafraîchir
          </LoadingButton>

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
          id="demandes-all-start"
          placeholder="Date début"
          defaultDate={filters.dateStart || undefined}
          onChange={(_, dateStr) => setFilters((p) => ({ ...p, dateStart: dateStr }))}
        />
        <DatePicker
          id="demandes-all-end"
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
                <th className="px-4 py-3">Motif</th>
                <th className="px-4 py-3">Bénéficiaire</th>
                <th className="px-4 py-3">Montant</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Créée</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={7}>Chargement...</td></tr>
              ) : error ? (
                <tr><td className="px-4 py-4 text-red-600 dark:text-red-400" colSpan={7}>{error}</td></tr>
              ) : paginated.length === 0 ? (
                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={7}>Aucune demande.</td></tr>
              ) : (
                paginated.map((d) => (
                  <tr key={d.uuid} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-3 font-mono text-xs">{d.uuid}</td>
                    <td className="px-4 py-3">{d.motif}</td>
                    <td className="px-4 py-3">{d.beneficiaire}</td>
                    <td className="px-4 py-3">{formatMoney(d.montant)} FCFA</td>
                    <td className="px-4 py-3">{labelDemandeStatut(d.statut)}</td>
                    <td className="px-4 py-3">{formatDate(d.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          to={`/demandes/${d.uuid}`}
                          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                          title="Voir"
                        >
                          <EyeIcon />
                        </Link>

                        <button
                          type="button"
                          disabled={!canPayThisDemande(d)}
                          onClick={() => {
                            setSelectedDemande(d);
                            setPayOpen(true);
                          }}
                          className={`p-2 border rounded-lg dark:border-gray-800 ${canPayThisDemande(d)
                              ? "border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-950"
                              : "border-gray-200 opacity-50 cursor-not-allowed"
                            }`}
                          title="Payer"
                        >
                          <MoneyIcon />
                        </button>
                      </div>
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

      <CreatePaiementModal
        open={payOpen}
        demande={selectedDemande}
        onClose={() => setPayOpen(false)}
        onCreated={() => fetchData()}
      />
    </div>
  );
}
