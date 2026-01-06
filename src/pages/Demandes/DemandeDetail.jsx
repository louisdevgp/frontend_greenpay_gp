import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getDemande } from "../../services/demandes.services";
import { listDocuments } from "../../services/documents.service";
import { useAuth } from "../../context/AuthContext";
import CreatePaiementModal from "../Paiements/CreatePaiementModal";
import DemandeEditModal from "./DemandeEditModal";

function formatMoney(v) {
    const n = Number(v ?? 0);
    if (Number.isNaN(n)) return String(v ?? "");
    return new Intl.NumberFormat("fr-FR").format(n);
}

function formatDateTime(iso) {
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

function hasAnyValidatedStep(demande) {
    const steps = demande?.validation_steps || [];
    return steps.some((s) => String(s?.status || "").toLowerCase() === "valide");
}

// (optionnel) si tu veux bloquer aussi quand y’a rejet
function hasAnyDecisionStep(demande) {
    const steps = demande?.validation_steps || [];
    return steps.some((s) => ["valide", "rejete"].includes(String(s?.status || "").toLowerCase()));
}


export default function DemandeDetail() {
    const { uuid } = useParams();
    const { user } = useAuth();
    const roles = (user?.roles || []).map((r) => String(r).toUpperCase());

    const canPayRole = roles.includes("DAF") || roles.includes("COMPTABLE") || roles.includes("ADMIN");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [demande, setDemande] = useState(null);

    const [docsLoading, setDocsLoading] = useState(true);
    const [documents, setDocuments] = useState([]);

    const [payOpen, setPayOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const canEditAll = !hasAnyValidatedStep(demande);
    const locked = hasAnyValidatedStep(demande);

    const canPayThis = useMemo(() => {
        const s = String(demande?.statut || "").toLowerCase();
        return canPayRole && (s === "approuvee" || s === "en_attente_paiement");
    }, [demande?.statut, canPayRole]);

    const fetchDemande = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await getDemande(uuid);
            if (!res?.success) throw new Error(res?.message || "Erreur chargement demande");
            setDemande(res.data);
        } catch (e) {
            setError(e?.message || "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    const fetchDocs = async (demandeId) => {
        setDocsLoading(true);
        try {
            const res = await listDocuments({ demande_id: demandeId });
            if (!res?.success) throw new Error(res?.message || "Erreur chargement documents");
            setDocuments(res.data || []);
        } catch (e) {
            // on garde l’erreur silencieuse ici
            setDocuments([]);
        } finally {
            setDocsLoading(false);
        }
    };

    useEffect(() => {
        fetchDemande();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uuid]);

    useEffect(() => {
        if (demande?.id) fetchDocs(demande.id);
    }, [demande?.id]);

    if (loading) {
        return <div className="text-sm text-gray-500 dark:text-gray-400">Chargement...</div>;
    }

    if (error) {
        return <div className="text-sm text-red-600 dark:text-red-400">{error}</div>;
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Détail demande</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        UUID: <span className="font-mono">{demande?.uuid}</span>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={fetchDemande}
                        className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
                    >
                        Rafraîchir
                    </button>

                    <button
                        type="button"
                        disabled={!canPayThis}
                        onClick={() => setPayOpen(true)}
                        className={`px-4 py-2 text-sm rounded-lg ${canPayThis
                            ? "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                            }`}
                    >
                        Payer
                    </button>
                </div>
            </div>

            {/* Infos */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Info label="Motif" value={demande?.motif || "-"} />
                <Info label="Bénéficiaire" value={demande?.beneficiaire || "-"} />
                <Info label="Statut" value={demande?.statut || "-"} />
                <Info label="Montant" value={`${formatMoney(demande?.montant)} FCFA`} />
                <Info label="Créée le" value={formatDateTime(demande?.created_at)} />
                <Info label="MàJ le" value={formatDateTime(demande?.updated_at)} />
            </div>

            {/* Description */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                <div className="text-sm font-medium text-gray-800 dark:text-white/90">Description</div>
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                    {demande?.description || "-"}
                </div>
            </div>

            {/* Documents */}
            <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
                <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents liés</div>
                    <button
                        type="button"
                        onClick={() => demande?.id && fetchDocs(demande.id)}
                        className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                    >
                        Recharger
                    </button>
                </div>

                {docsLoading ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Chargement documents...</div>
                ) : documents.length === 0 ? (
                    <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aucun document.</div>
                ) : (
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left bg-gray-50 dark:bg-gray-950">
                                <tr>
                                    <th className="px-3 py-2">Type</th>
                                    <th className="px-3 py-2">Nom fichier</th>
                                    <th className="px-3 py-2">Format</th>
                                    <th className="px-3 py-2">Taille</th>
                                    <th className="px-3 py-2">Créé</th>
                                    <th className="px-3 py-2 text-right">Ouvrir</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc.id} className="border-t border-gray-100 dark:border-gray-800">
                                        <td className="px-3 py-2">{doc.type_document}</td>
                                        <td className="px-3 py-2">{doc.nom_fichier}</td>
                                        <td className="px-3 py-2">{doc.format}</td>
                                        <td className="px-3 py-2">{doc.taille ? Number(doc.taille).toLocaleString("fr-FR") : "-"}</td>
                                        <td className="px-3 py-2">{formatDateTime(doc.created_at)}</td>
                                        <td className="px-3 py-2 text-right">
                                            <a
                                                href={doc.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                                            >
                                                Ouvrir
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal paiement (contextuel) */}
            <CreatePaiementModal
                open={payOpen}
                demande={demande}
                onClose={() => setPayOpen(false)}
                onCreated={() => {
                    fetchDemande();
                    demande?.id && fetchDocs(demande.id); // au cas où preuves
                }}
            />
            <DemandeEditModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                demande={demande}
                canEditAll={!hasAnyValidatedStep(demande)}
                onUpdated={fetchDemandeDetail}
            />
        </div>
    );
}

function Info({ label, value }) {
    return (
        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{value}</div>
        </div>
    );
}
