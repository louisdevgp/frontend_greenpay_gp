import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPaiements } from "../../services/paiements.service";
import CreatePaiementModal from "./CreatePaiementModal.jsx";


function EyeIcon({ className = "w-5 h-5" }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path
                d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
        </svg>
    );
}

function PencilIcon({ className = "w-5 h-5" }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M12 20h9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function TrashIcon({ className = "w-5 h-5" }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M3 6h18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M8 6V4h8v2"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path
                d="M19 6l-1 14H6L5 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path
                d="M10 11v6M14 11v6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function PaperclipIcon({ className = "w-5 h-5" }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M21 12.5l-8.5 8.5a6 6 0 0 1-8.5-8.5l9-9a4 4 0 0 1 5.5 5.5l-9 9a2 2 0 1 1-2.8-2.8l8.3-8.3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}



// Helpers
function formatMoney(v) {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return String(v ?? "");
    return new Intl.NumberFormat("fr-FR").format(n);
}

function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return new Intl.DateTimeFormat("fr-FR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(d);
}

function includesText(obj, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    const blob = JSON.stringify(obj ?? {}).toLowerCase();
    return blob.includes(s);
}

export default function PaiementsList() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [items, setItems] = useState([]);
    const [openCreate, setOpenCreate] = useState(false);


    // Filters
    const [q, setQ] = useState("");
    const [moyen, setMoyen] = useState(""); // virement, cheque, espece...
    const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd
    const [dateTo, setDateTo] = useState("");     // yyyy-mm-dd

    const fetchData = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await listPaiements();
            if (!res?.success) throw new Error(res?.message || "Erreur chargement paiements");
            setItems(res.data || []);
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
        const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
        const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

        return (items || [])
            .filter((x) => includesText(x, q))
            .filter((x) => (moyen ? String(x?.moyen_paiement || "").toLowerCase() === moyen.toLowerCase() : true))
            .filter((x) => {
                if (!fromTs && !toTs) return true;
                const ts = x?.date_paiement ? new Date(x.date_paiement).getTime() : null;
                if (!ts) return false;
                if (fromTs && ts < fromTs) return false;
                if (toTs && ts > toTs) return false;
                return true;
            });
    }, [items, q, moyen, dateFrom, dateTo]);

    return (
        <>
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Paiements</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        Liste des paiements enregistrés ({filtered.length})
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchData}
                    className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                >
                    Rafraîchir
                </button>
                <button
                    type="button"
                    onClick={() => setOpenCreate(true)}
                    className="px-4 py-2 text-sm rounded-lg bg-brand-500 text-white hover:opacity-90"
                >
                    Nouveau paiement
                </button>

            </div>

            {/* Filters */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <div>
                        <label className="block mb-1 text-xs text-gray-500 dark:text-gray-400">Recherche</label>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="UUID, demande_id, commentaire..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-xs text-gray-500 dark:text-gray-400">Moyen</label>
                        <select
                            value={moyen}
                            onChange={(e) => setMoyen(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        >
                            <option value="">Tous</option>
                            <option value="virement">Virement</option>
                            <option value="cheque">Chèque</option>
                            <option value="espece">Espèces</option>
                            <option value="mobile_money">Mobile Money</option>
                        </select>
                    </div>

                    <div>
                        <label className="block mb-1 text-xs text-gray-500 dark:text-gray-400">Date début</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        />
                    </div>

                    <div>
                        <label className="block mb-1 text-xs text-gray-500 dark:text-gray-400">Date fin</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        />
                    </div>
                </div>

                <div className="flex gap-2 mt-3">
                    <button
                        type="button"
                        onClick={() => {
                            setQ("");
                            setMoyen("");
                            setDateFrom("");
                            setDateTo("");
                        }}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                    >
                        Réinitialiser
                    </button>
                </div>
            </div>

            {/* States */}
            {loading ? (
                <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>
                </div>
            ) : error ? (
                <div className="p-6 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            ) : (
                <div className="overflow-hidden bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-950 dark:text-gray-400">
                                <tr>
                                    <th className="px-4 py-3 text-left">Date</th>
                                    <th className="px-4 py-3 text-left">Demande ID</th>
                                    <th className="px-4 py-3 text-left">Type</th>
                                    <th className="px-4 py-3 text-left">Moyen</th>
                                    <th className="px-4 py-3 text-right">Montant</th>
                                    <th className="px-4 py-3 text-left">Commentaire</th>
                                    <th className="px-4 py-3 text-left">Docs</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                {filtered.map((p) => (
                                    <tr key={p.uuid || p.id} className="hover:bg-gray-50 dark:hover:bg-gray-950/50">
                                        {/* <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.date_paiement)}</td>
                     */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Link
                                                to={`/paiements/${p.uuid}`}
                                                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                                            >
                                                {formatDate(p.date_paiement)}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">{p.demande_id}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{p.type_paiement || "-"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">{p.moyen_paiement || "-"}</td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {formatMoney(p.montant)}{" "}
                                            <span className="text-xs text-gray-400">FCFA</span>
                                        </td>
                                        <td className="px-4 py-3">{p.commentaire || "-"}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            {Array.isArray(p.documents) ? p.documents.length : 0}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right">
                                            <div className="inline-flex items-center gap-1">
                                                {/* Voir */}
                                                <Link
                                                    to={`/paiements/${p.uuid}`}
                                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                                                    title="Voir"
                                                >
                                                    <EyeIcon />
                                                </Link>

                                                {/* Éditer (placeholder) */}
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="p-2 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed dark:border-gray-800"
                                                    title="Éditer (bientôt)"
                                                >
                                                    <PencilIcon />
                                                </button>

                                                {/* Supprimer (placeholder) */}
                                                <button
                                                    type="button"
                                                    disabled
                                                    className="p-2 border border-gray-200 rounded-lg opacity-50 cursor-not-allowed dark:border-gray-800"
                                                    title="Supprimer (bientôt)"
                                                >
                                                    <TrashIcon />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={!Array.isArray(p.documents) || p.documents.length === 0}
                                                    onClick={() => {
                                                        // mini: pour l’instant on affiche juste une alerte
                                                        // après: on ouvrira un modal "Documents"
                                                        alert(`Documents: ${(p.documents || []).length}`);
                                                    }}
                                                    className={`p-2 border rounded-lg dark:border-gray-800 ${Array.isArray(p.documents) && p.documents.length > 0
                                                        ? "border-gray-200 hover:bg-gray-50 dark:hover:bg-gray-950"
                                                        : "border-gray-200 opacity-50 cursor-not-allowed"
                                                        }`}
                                                    title="Documents"
                                                >
                                                    <PaperclipIcon />
                                                </button>
                                            </div>
                                        </td>

                                    </tr>
                                ))}

                                {filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                                            Aucun paiement trouvé.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
        <CreatePaiementModal open={openCreate} onClose={() => setOpenCreate(false)} onCreated={fetchData} />
        </>
    );
}
