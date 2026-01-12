import React, { useEffect, useMemo, useState } from "react";
import { createPaiement } from "../../services/paiements.service";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";
import DatePicker from "../../components/form/date-picker";



const MOYENS = ["virement", "cheque", "especes", "mobile_money"];
const TYPE_PAIEMENT = [
  { value: "total", label: "Total" },
  { value: "partiel", label: "Partiel" },
];

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function CreatePaiementModal({ open, onClose, demande, onCreated }) {
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
    require_docs: true,
  });

  const [docs, setDocs] = useState({
    type_document: "preuve_paiement",
    files: [],
  });

  const demandeMontant = useMemo(() => Number(demande?.montant ?? 0), [demande?.montant]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSubmitting(false);
    setForm((p) => ({
      ...p,
      type_paiement: "total",
      montant: demandeMontant ? String(demandeMontant) : "",
      date_paiement: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      moyen_paiement: "virement",
      reference_piece: "",
      compte_debite: "",
      commentaire: "",
      require_docs: true,
    }));
    setDocs({ type_document: "preuve_paiement", files: [] });
  }, [open, demandeMontant]);

  const isTotal = form.type_paiement === "total";

  useEffect(() => {
    if (!open) return;
    if (isTotal && demandeMontant) {
      setForm((p) => ({ ...p, montant: String(demandeMontant) }));
    }
  }, [isTotal, demandeMontant, open]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const validate = () => {
    if (!demande?.id && !demande?.demande_id) return "Demande introuvable";
    if (!form.type_paiement) return "Type paiement obligatoire";
    if (!form.moyen_paiement) return "Moyen paiement obligatoire";

    const m = Number(form.montant);
    if (!m || Number.isNaN(m) || m <= 0) return "Montant invalide";

    if (isTotal && demandeMontant && m !== demandeMontant) {
      return "Montant total doit égaler le montant de la demande";
    }

    if (!form.date_paiement) return "Date paiement obligatoire";

    if (form.require_docs && (!docs.files?.length)) {
      return "Veuillez joindre au moins un document";
    }

    return "";
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setError("");

    const msg = validate();
    if (msg) return setError(msg);

    try {
      setSubmitting(true);

      // ✅ 1) Créer paiement (JSON)
      const payload = {
        demande_id: demande.id ?? demande.demande_id,
        type_paiement: form.type_paiement,
        montant: String(Number(form.montant)),
        date_paiement: new Date(form.date_paiement).toISOString(),
        moyen_paiement: form.moyen_paiement,
        reference_piece: form.reference_piece?.trim() || null,
        compte_debite: form.compte_debite?.trim() || null,
        commentaire: form.commentaire?.trim() || null,
      };

      const res = await createPaiement(payload);
      if (!res?.success) throw new Error(res?.message || "Création paiement échouée");

      const paiement = res?.data;
      const paiementId = paiement?.id;

      if (!paiementId) {
        throw new Error("Paiement créé mais ID manquant (réponse backend invalide).");
      }

      // ✅ 2) Upload documents (API séparée)
      if (form.require_docs && docs.files?.length) {
        await uploadManyDocuments({
          files: docs.files,
          type_document: docs.type_document,
          paiement_id: paiementId,
        });
      }

      onCreated?.(paiement);
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouveau paiement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Demande: <span className="font-mono text-xs">{demande?.uuid || demande?.demande_uuid || "-"}</span>
              {" — "}Montant: {formatMoney(demandeMontant)} FCFA
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
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
            <Field label="Type paiement">
              <select
                value={form.type_paiement}
                onChange={(e) => setField("type_paiement", e.target.value)}
                className={fieldClass}
              >
                {TYPE_PAIEMENT.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Montant">
              <input
                value={form.montant}
                onChange={(e) => setField("montant", e.target.value)}
                className={fieldClass}
                disabled={isTotal}
                placeholder="Ex: 200000"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aperçu: {formatMoney(form.montant)} FCFA</p>
            </Field>

            <Field label="Date paiement">
              <DatePicker
                id="paiement-date-paiement"
                placeholder="YYYY-MM-DD"
                dateFormat="Y-m-d"
                defaultDate={form.date_paiement || undefined}
                onChange={(_, dateStr) => setField("date_paiement", dateStr)}
              />
            </Field>

            <Field label="Moyen paiement">
              <select
                value={form.moyen_paiement}
                onChange={(e) => setField("moyen_paiement", e.target.value)}
                className={fieldClass}
              >
                {MOYENS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Référence pièce">
              <input
                value={form.reference_piece}
                onChange={(e) => setField("reference_piece", e.target.value)}
                className={fieldClass}
                placeholder="Ex: VIRM-2026-0001"
              />
            </Field>

            <Field label="Compte débité">
              <input
                value={form.compte_debite}
                onChange={(e) => setField("compte_debite", e.target.value)}
                className={fieldClass}
                placeholder="Ex: BICICI 0102..."
              />
            </Field>
          </div>

          <Field label="Commentaire">
            <textarea
              rows={3}
              value={form.commentaire}
              onChange={(e) => setField("commentaire", e.target.value)}
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
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents (preuves)</div>

              <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                <Field label="Type document">
                  <select
                    value={docs.type_document}
                    onChange={(e) => setDocs((p) => ({ ...p, type_document: e.target.value }))}
                    className={fieldClass}
                  >
                    <option value="preuve_paiement">preuve_paiement</option>
                    <option value="recu">recu</option>
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
