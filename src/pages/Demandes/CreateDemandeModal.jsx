import React, { useMemo, useState } from "react";
import { createDemande } from "../../services/demandes.services";
import { uploadManyDocuments } from "../../services/documents.service";

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}

const DOC_TYPES = [
  { value: "proforma", label: "Proforma" },
  { value: "devis", label: "Devis" },
  { value: "autre", label: "Autre" },
];

export default function CreateDemandeModal({ open, onClose, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    motif: "",
    description: "",
    montant: "",
    devise: "XOF",
    beneficiaire: "",
    remarque: "",
    paiement_immediat: false,
    require_docs: false,
  });

  const [docs, setDocs] = useState({
    type_document: "proforma",
    files: [],
  });

  const montantNum = useMemo(() => {
    const n = Number(form.montant);
    return Number.isNaN(n) ? 0 : n;
  }, [form.montant]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.motif.trim()) return "Motif obligatoire";
    if (!form.beneficiaire.trim()) return "Bénéficiaire obligatoire";
    if (!form.montant || Number.isNaN(Number(form.montant)) || Number(form.montant) <= 0) return "Montant invalide";
    if (form.require_docs && (!docs.files || docs.files.length === 0)) return "Veuillez joindre au moins un document.";
    return "";
  };

  const reset = () => {
    setError("");
    setSubmitting(false);
    setForm({
      motif: "",
      description: "",
      montant: "",
      devise: "XOF",
      beneficiaire: "",
      remarque: "",
      paiement_immediat: false,
      require_docs: false,
    });
    setDocs({ type_document: "proforma", files: [] });
  };

  const close = () => {
    if (submitting) return;
    reset();
    onClose?.();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const msg = validate();
    if (msg) return setError(msg);

    try {
      setSubmitting(true);

      const payload = {
        motif: form.motif.trim(),
        description: form.description?.trim() || null,
        montant: String(Number(form.montant)),
        devise: form.devise || null,
        beneficiaire: form.beneficiaire.trim(),
        remarque: form.remarque?.trim() || null,
        paiement_immediat: !!form.paiement_immediat,
      };

      const res = await createDemande(payload);
      if (!res?.success) throw new Error(res?.message || "Création demande échouée");

      const demande = res.data;

      if (form.require_docs) {
        await uploadManyDocuments({
          files: docs.files,
          demande_id: demande.id,
          type_document: docs.type_document,
        });
      }

      onCreated?.(demande);
      close();
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      <div className="relative w-full max-w-2xl p-5 bg-white border border-gray-200 rounded-2xl shadow-xl dark:bg-gray-900 dark:border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouvelle demande</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Créer + joindre documents si require_docs.</p>
          </div>
          <button type="button" className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800" onClick={close}>
            Fermer
          </button>
        </div>

        {error ? (
          <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Motif *">
              <input
                value={form.motif}
                onChange={(e) => setField("motif", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Bénéficiaire *">
              <input
                value={form.beneficiaire}
                onChange={(e) => setField("beneficiaire", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Montant *">
              <input
                value={form.montant}
                onChange={(e) => setField("montant", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Aperçu: {formatMoney(montantNum)} FCFA
              </p>
            </Field>

            <Field label="Devise">
              <select
                value={form.devise}
                onChange={(e) => setField("devise", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="XOF">XOF (FCFA)</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </Field>

          <Field label="Remarque">
            <textarea
              value={form.remarque}
              onChange={(e) => setField("remarque", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Paiement immédiat">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.paiement_immediat}
                  onChange={(e) => setField("paiement_immediat", e.target.checked)}
                />
                Oui
              </label>
            </Field>

            <Field label="Joindre docs ?">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={form.require_docs}
                  onChange={(e) => setField("require_docs", e.target.checked)}
                />
                require_docs
              </label>
            </Field>
          </div>

          {form.require_docs ? (
            <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents</div>
              <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                <Field label="Type document">
                  <select
                    value={docs.type_document}
                    onChange={(e) => setDocs((p) => ({ ...p, type_document: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Fichiers *">
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
            <button type="button" onClick={close} className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
            >
              {submitting ? "Traitement..." : "Créer"}
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
