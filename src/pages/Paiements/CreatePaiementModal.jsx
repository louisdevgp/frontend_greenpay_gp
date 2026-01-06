import React, { useEffect, useMemo, useState } from "react";
import { createPaiement } from "../../services/paiements.service";
import { uploadManyDocuments } from "../../services/documents.service";

export default function CreatePaiementModal({
  open,
  onClose,
  onCreated,
  demande, // ✅ { id, uuid, montant, beneficiaire, motif, statut ... }
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    type_paiement: "total",
    montant: "",
    date_paiement: "",
    moyen_paiement: "virement",
    reference_piece: "",
    compte_debite: "",
    commentaire: "",
  });

  const [files, setFiles] = useState([]);

  const demandeMontant = useMemo(() => {
    const n = Number(demande?.montant ?? 0);
    return Number.isNaN(n) ? 0 : n;
  }, [demande]);

  // reset quand on ouvre / change de demande
  useEffect(() => {
    if (!open) return;
    setError("");
    setFiles([]);
    setForm((p) => ({
      ...p,
      type_paiement: "total",
      montant: demandeMontant ? String(demandeMontant) : "",
    }));
  }, [open, demande?.id, demandeMontant]);

  // auto sync montant si total
  useEffect(() => {
    if (!demande?.id) return;
    if (form.type_paiement === "total") {
      setForm((p) => ({ ...p, montant: String(demandeMontant || "") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.type_paiement, demandeMontant, demande?.id]);

  if (!open) return null;

  const setField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!demande?.id) return setError("Demande introuvable.");
    if (!form.date_paiement) return setError("Veuillez renseigner la date de paiement.");

    const montantPay = form.type_paiement === "total" ? demandeMontant : Number(form.montant);

    if (!montantPay || Number.isNaN(montantPay) || montantPay <= 0) {
      return setError("Montant invalide.");
    }
    if (montantPay > demandeMontant) {
      return setError("Le montant ne peut pas dépasser le montant de la demande.");
    }

    try {
      setSubmitting(true);

      // 1) create paiement
      const resPay = await createPaiement({
        demande_id: demande.id,
        type_paiement: form.type_paiement,
        montant: String(montantPay),
        date_paiement: form.date_paiement,
        moyen_paiement: form.moyen_paiement,
        reference_piece: form.reference_piece || null,
        compte_debite: form.compte_debite || null,
        commentaire: form.commentaire || null,
      });

      if (!resPay?.success) throw new Error(resPay?.message || "Création paiement échouée");
      const paiement = resPay.data;

      // 2) upload docs (1 fichier par call)
      if (files.length > 0) {
        await uploadManyDocuments({
          files,
          type_document: "preuve_paiement",
          demande_id: demande.id,
          paiement_id: paiement.id,
        });
      }

      onCreated?.(paiement);
      onClose?.();
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => !submitting && onClose?.()} />

      <div className="relative w-full max-w-2xl p-5 bg-white border border-gray-200 rounded-2xl shadow-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Enregistrer un paiement
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Demande: <span className="font-mono">{demande?.uuid}</span>
            </p>
          </div>

          <button
            type="button"
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            onClick={() => !submitting && onClose?.()}
          >
            Fermer
          </button>
        </div>

        {/* Résumé demande */}
        <div className="p-4 mt-4 border border-gray-200 rounded-xl dark:border-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Info label="Bénéficiaire" value={demande?.beneficiaire || "-"} />
            <Info label="Motif" value={demande?.motif || "-"} />
            <Info label="Montant demande" value={`${demandeMontant} FCFA`} />
          </div>
        </div>

        {error ? (
          <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {/* Form */}
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Type paiement">
              <select
                value={form.type_paiement}
                onChange={(e) => setField("type_paiement", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="total">Total</option>
                <option value="partiel">Partiel</option>
              </select>
            </Field>

            <Field label="Montant payé">
              <input
                value={form.type_paiement === "total" ? String(demandeMontant) : form.montant}
                onChange={(e) => setField("montant", e.target.value)}
                readOnly={form.type_paiement === "total"}
                className={`w-full px-3 py-2 text-sm border rounded-lg outline-none dark:border-gray-800 ${
                  form.type_paiement === "total"
                    ? "bg-gray-50 border-gray-200 dark:bg-gray-950"
                    : "border-gray-200 dark:bg-gray-950"
                }`}
              />
              {form.type_paiement === "partiel" ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Max: {demandeMontant} FCFA
                </p>
              ) : null}
            </Field>

            <Field label="Date paiement *">
              <input
                type="datetime-local"
                value={form.date_paiement}
                onChange={(e) => setField("date_paiement", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Moyen paiement">
              <select
                value={form.moyen_paiement}
                onChange={(e) => setField("moyen_paiement", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="virement">Virement</option>
                <option value="cheque">Chèque</option>
                <option value="espece">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
              </select>
            </Field>

            <Field label="Référence pièce">
              <input
                value={form.reference_piece}
                onChange={(e) => setField("reference_piece", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Compte débité">
              <input
                value={form.compte_debite}
                onChange={(e) => setField("compte_debite", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Preuves (documents)">
              <input
                type="file"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                className="w-full text-sm"
              />
              {files.length ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {files.length} fichier(s)
                </p>
              ) : null}
            </Field>
          </div>

          <Field label="Commentaire">
            <textarea
              value={form.commentaire}
              onChange={(e) => setField("commentaire", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
            >
              {submitting ? "Enregistrement..." : "Valider le paiement"}
            </button>
          </div>
        </form>
      </div>
    </div>
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

function Info({ label, value }) {
  return (
    <div className="p-3 border border-gray-100 rounded-lg dark:border-gray-800">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-sm text-gray-800 dark:text-white/90 break-words">{value}</div>
    </div>
  );
}
