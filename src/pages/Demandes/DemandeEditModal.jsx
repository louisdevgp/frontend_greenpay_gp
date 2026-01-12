import React, { useEffect, useMemo, useState } from "react";
import { updateDemande } from "../../services/demandes.services";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";

const DOC_TYPES = [
  { value: "proforma", label: "Proforma" },
  { value: "devis", label: "Devis" },
  { value: "autre", label: "Autre" },
];

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function DemandeEditModal({
  open,
  onClose,
  demande,
  canEditAll = true,
  onUpdated,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    motif: "",
    description: "",
    montant: "",
    beneficiaire: "",
    remarque: "",
    require_docs: false,
  });

  const [docs, setDocs] = useState({
    type_document: "proforma",
    files: [],
  });

  useEffect(() => {
    if (!open || !demande) return;
    setError("");
    setSubmitting(false);
    setForm({
      motif: demande.motif || "",
      description: demande.description || "",
      montant: demande.montant != null ? String(demande.montant) : "",
      beneficiaire: demande.beneficiaire || "",
      remarque: demande.remarque || "",
      require_docs: false,
    });
    setDocs({ type_document: "proforma", files: [] });
  }, [open, demande]);

  const montantPreview = useMemo(() => formatMoney(form.montant), [form.montant]);

  const hasFournisseur = useMemo(() => {
    return Boolean(demande?.fournisseur_id);
  }, [demande?.fournisseur_id]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const validate = () => {
    if (!canEditAll) return "Cette demande ne peut plus être modifiée (validation engagée).";
    if (!form.motif.trim()) return "Motif obligatoire";
    if (!hasFournisseur && !form.beneficiaire.trim()) return "Bénéficiaire obligatoire";
    if (!form.montant || Number.isNaN(Number(form.montant)) || Number(form.montant) <= 0) return "Montant invalide";
    if (form.require_docs && (!docs.files || docs.files.length === 0)) return "Veuillez joindre au moins un document.";
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
        motif: form.motif.trim(),
        description: form.description?.trim() || null,
        montant: String(Number(form.montant)),
        ...(hasFournisseur ? {} : { beneficiaire: form.beneficiaire.trim() }),
        remarque: form.remarque?.trim() || null,
      };

      const res = await updateDemande(demande.uuid || demande.id, payload);
      if (!res?.success) throw new Error(res?.message || "Modification échouée");

      if (canEditAll && form.require_docs && docs.files?.length) {
        await uploadManyDocuments({
          files: docs.files,
          demande_id: demande.id,
          type_document: docs.type_document,
        });
      }

      onUpdated?.();
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
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Modifier la demande</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {canEditAll ? "Tous les champs sont modifiables." : "Seul le statut est modifiable (validation déjà commencée)."}
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
            <Field label="Motif">
              <input value={form.motif} onChange={(e) => setField("motif", e.target.value)} className={fieldClass} disabled={!canEditAll} />
            </Field>

            <Field label={hasFournisseur ? "Bénéficiaire (auto)" : "Bénéficiaire"}>
              <input
                value={form.beneficiaire}
                onChange={(e) => setField("beneficiaire", e.target.value)}
                className={fieldClass}
                disabled={!canEditAll || hasFournisseur}
                placeholder={hasFournisseur ? "Déduit du fournisseur" : undefined}
              />
            </Field>

            <Field label="Montant">
              <input
                value={form.montant}
                onChange={(e) => setField("montant", e.target.value)}
                className={fieldClass}
                disabled={!canEditAll}
                placeholder="Ex: 500000"
              />
              {canEditAll ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aperçu: {montantPreview} FCFA</p> : null}
            </Field>

            <div />
          </div>

          <Field label="Description">
            <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className={fieldClass} disabled={!canEditAll} />
          </Field>

          <Field label="Remarque">
            <textarea rows={3} value={form.remarque} onChange={(e) => setField("remarque", e.target.value)} className={fieldClass} disabled={!canEditAll} />
          </Field>

          {canEditAll ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Joindre documents maintenant ?">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={form.require_docs} onChange={(e) => setField("require_docs", e.target.checked)} />
                  Joindre maintenant
                </label>
              </Field>
              <div />
            </div>
          ) : null}

          {canEditAll && form.require_docs ? (
            <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents</div>

              <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-2">
                <Field label="Type document">
                  <select
                    value={docs.type_document}
                    onChange={(e) => setDocs((p) => ({ ...p, type_document: e.target.value }))}
                    className={fieldClass}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Fichiers">
                  <input type="file" multiple onChange={(e) => setDocs((p) => ({ ...p, files: Array.from(e.target.files || []) }))} className="w-full text-sm" />
                  {docs.files?.length ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{docs.files.length} fichier(s)</p> : null}
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
              disabled={submitting || !canEditAll}
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
