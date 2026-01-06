import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listMyDemandes } from "../../services/demandes.services";
import CreateDemandeModal from "./CreateDemandeModal";


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

export default function DemandesMyList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [rows, setRows] = useState([]);
    const [openCreate, setOpenCreate] = useState(false);

    const [filters, setFilters] = useState({
        statut: "",
        beneficiaire: "",
        dateStart: "",
        dateEnd: "",
    });

    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await listMyDemandes();
            if (!res?.success) throw new Error(res?.message || "Erreur chargement mes demandes");
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
        return (rows || []).filter((d) => {
            const okStatut = !filters.statut || String(d.statut || "").toLowerCase().includes(filters.statut.toLowerCase());
            const okBenef = !filters.beneficiaire || String(d.beneficiaire || "").toLowerCase().includes(filters.beneficiaire.toLowerCase());

            const created = d.created_at ? new Date(d.created_at) : null;
            const start = filters.dateStart ? new Date(filters.dateStart) : null;
            const end = filters.dateEnd ? new Date(filters.dateEnd) : null;

            const okStart = !start || (created && created >= start);
            const okEnd = !end || (created && created <= end);

            return okStatut && okBenef && okStart && okEnd;
        });
    }, [rows, filters]);

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Mes demandes</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Suivi de vos demandes.</p>
                </div>

                <button
                    type="button"
                    onClick={fetchData}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                >
                    Rafraîchir
                </button>
                <button onClick={() => setOpenCreate(true)} className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900">
                    Nouvelle demande
                </button>
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
                <input
                    type="date"
                    value={filters.dateStart}
                    onChange={(e) => setFilters((p) => ({ ...p, dateStart: e.target.value }))}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                />
                <input
                    type="date"
                    value={filters.dateEnd}
                    onChange={(e) => setFilters((p) => ({ ...p, dateEnd: e.target.value }))}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
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
                            ) : filtered.length === 0 ? (
                                <tr><td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={7}>Aucune demande.</td></tr>
                            ) : (
                                filtered.map((d) => (
                                    <tr key={d.uuid} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-4 py-3 font-mono text-xs">{d.uuid}</td>
                                        <td className="px-4 py-3">{d.motif}</td>
                                        <td className="px-4 py-3">{d.beneficiaire}</td>
                                        <td className="px-4 py-3">{formatMoney(d.montant)} FCFA</td>
                                        <td className="px-4 py-3">{d.statut}</td>
                                        <td className="px-4 py-3">{formatDate(d.created_at)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Link
                                                to={`/demandes/${d.uuid}`}
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
            </div>
                  <CreateDemandeModal
  open={openCreate}
  onClose={() => setOpenCreate(false)}
  onCreated={() => fetchData()}   // refresh liste
/>
        </div>
    );
}
