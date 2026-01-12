import React, { useEffect, useState } from "react";
import { createReception } from "../../services/receptions.service";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";
import DatePicker from "../../components/form/date-picker";

export default function CreateReceptionModal({ open, paiement, demande, bon_commande_id, onClose, onCreated }) {
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const [form, setForm] = useState({
        date_reception: "",
        description: "",
        conforme: true,
        reference_facture: "",
        montant: "",
        observations: "",
        require_docs: true,
    });

    const [docs, setDocs] = useState({
        type_document: "pv_reception",
        files: [],
    });

    useEffect(() => {
        if (!open) return;
        setSubmitting(false);
        setError("");
        setForm({
            date_reception: new Date().toISOString().slice(0, 10),
            description: "",
            conforme: true,
            reference_facture: "",
            montant: "",
            observations: "",
            require_docs: true,
        });
        setDocs({ type_document: "pv_reception", files: [] });
    }, [open]);

    const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const close = () => {
        if (submitting) return;
        onClose?.();
    };

    const validate = () => {
        if (!paiement?.id && !demande?.id) return "Paiement ou demande introuvable";
        if (!form.date_reception) return "Date réception obligatoire";
        if (!form.description.trim()) return "Description obligatoire";
        if (form.require_docs && (!docs.files?.length)) return "Veuillez joindre au moins un document";
        return "";
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const msg = validate();
        if (msg) return setError(msg);

        try {
            setSubmitting(true);

            const payload = {
                ...(paiement?.id ? { paiement_id: paiement.id } : {}),
                ...(demande?.id ? { demande_id: demande.id } : {}),
                bon_commande_id: bon_commande_id ?? null,
                date_reception: new Date(form.date_reception).toISOString(),
                conforme: !!form.conforme,
                description: form.description.trim(),
                reference_facture: form.reference_facture?.trim() || null,
                montant: form.montant ? String(form.montant).trim() : null,
                observations: form.observations?.trim() || null,
            };

            const res = await createReception(payload);
            if (!res?.success) throw new Error(res?.message || "Création réception échouée");

            const receptionId = res?.data?.id;
            if (form.require_docs && docs.files?.length && receptionId) {
                await uploadManyDocuments({
                    files: docs.files,
                    type_document: docs.type_document,
                    reception_id: receptionId,
                });
            }

            onCreated?.();
            close();
        } catch (err) {
            setError(err?.message || "Erreur inconnue");
            setSubmitting(false);
        }
    };

    if (!open) return null;

    const fieldClass =
        "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed";

    return (
        <Modal
            isOpen={open}
            onClose={close}
            showCloseButton={false}
            className="w-full max-w-3xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
        >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouvelle réception</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {paiement?.uuid ? (
                                <>Paiement: <span className="font-mono text-xs">{paiement.uuid}</span></>
                            ) : (
                                <>Demande: <span className="font-mono text-xs">{demande?.uuid || "-"}</span></>
                            )}
                        </p>
                    </div>
                    <button type="button" onClick={close} className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
                        Fermer
                    </button>
                </div>

                {error ? (
                    <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                        {error}
                    </div>
                ) : null}

                <form noValidate onSubmit={onSubmit} className="mt-4 space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Date réception">
                            <DatePicker
                                id="reception-date-reception"
                                placeholder="YYYY-MM-DD"
                                dateFormat="Y-m-d"
                                defaultDate={form.date_reception || undefined}
                                onChange={(_, dateStr) => setField("date_reception", dateStr)}
                            />
                        </Field>

                        <Field label="Conforme ?">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={!!form.conforme}
                                    onChange={(e) => setField("conforme", e.target.checked)}
                                />
                                conforme
                            </label>
                        </Field>
                    </div>

                    <Field label="Description">
                        <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) => setField("description", e.target.value)}
                            className={fieldClass}
                        />
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Référence facture (optionnel)">
                            <input
                                value={form.reference_facture}
                                onChange={(e) => setField("reference_facture", e.target.value)}
                                className={fieldClass}
                                placeholder="Ex: FAC-2026-0001"
                            />
                        </Field>

                        <Field label="Montant (optionnel)">
                            <input
                                value={form.montant}
                                onChange={(e) => setField("montant", e.target.value)}
                                className={fieldClass}
                                placeholder="Ex: 200000"
                            />
                        </Field>
                    </div>

                    <Field label="Observations (optionnel)">
                        <textarea
                            rows={3}
                            value={form.observations}
                            onChange={(e) => setField("observations", e.target.value)}
                            className={fieldClass}
                        />
                    </Field>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Field label="Joindre documents ?">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="checkbox"
                                    checked={form.require_docs}
                                    onChange={(e) => setField("require_docs", e.target.checked)}
                                />
                                require_docs
                            </label>
                        </Field>
                        <div />
                    </div>

                    {form.require_docs ? (
                        <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
                            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents</div>

                            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                                <Field label="Type document">
                                    <select
                                        value={docs.type_document}
                                        onChange={(e) => setDocs((p) => ({ ...p, type_document: e.target.value }))}
                                        className={fieldClass}
                                    >
                                        <option value="pv_reception">pv_reception</option>
                                        <option value="bon_livraison">bon_livraison</option>
                                        <option value="facture">facture</option>
                                        <option value="autre">autre</option>
                                    </select>
                                </Field>

                                <Field label="Fichiers">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => setDocs((p) => ({ ...p, files: Array.from(e.target.files || []) }))}
                                        className="w-full text-sm"
                                    />
                                    {docs.files?.length ? (
                                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{docs.files.length} fichier(s)</p>
                                    ) : null}
                                </Field>
                            </div>
                        </div>
                    ) : null}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={close}
                            disabled={submitting}
                            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
                        >
                            {submitting ? "Traitement..." : "Enregistrer"}
                        </button>
                    </div>
                </form>
        </Modal>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">{label}</div>
            {children}
        </div>
    );
}
