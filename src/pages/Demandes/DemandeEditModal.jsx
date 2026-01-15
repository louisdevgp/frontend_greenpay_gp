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
    conditions_paiement_mode: "100/100",
    paiement_immediat: false,
    require_docs: false,
  });

  const [docs, setDocs] = useState({
    type_document: "proforma",
    files: [],
  });

  const [docsTypeAutre, setDocsTypeAutre] = useState("");

  useEffect(() => {
    if (!open || !demande) return;
    setError("");
    setSubmitting(false);

    const conds = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    const modeFromText = String(conds?.[0]?.condition_texte || "").trim();
    let inferredMode = "100/100";
    if (modeFromText === "70/30" || modeFromText === "50/50" || modeFromText === "100/100") {
      inferredMode = modeFromText;
    } else if (conds.length === 2) {
      const pcts = conds.map((c) => Number(c?.pourcentage)).filter((n) => Number.isFinite(n));
      const s = pcts.sort((a, b) => b - a);
      if (s.length === 2 && Math.round(s[0]) === 70 && Math.round(s[1]) === 30) inferredMode = "70/30";
      if (s.length === 2 && Math.round(s[0]) === 50 && Math.round(s[1]) === 50) inferredMode = "50/50";
    } else if (conds.length === 1) {
      const pct = Number(conds?.[0]?.pourcentage);
      if (Number.isFinite(pct) && Math.round(pct) === 100) inferredMode = "100/100";
    }

    setForm({
      motif: demande.motif || "",
      description: demande.description || "",
      montant: demande.montant != null ? String(demande.montant) : "",
      beneficiaire: demande.beneficiaire || "",
      remarque: demande.remarque || "",
      conditions_paiement_mode: inferredMode,
      paiement_immediat: !!demande.paiement_immediat,
      require_docs: false,
    });
    setDocs({ type_document: "proforma", files: [] });
    setDocsTypeAutre("");
  }, [open, demande]);

  const montantPreview = useMemo(() => formatMoney(form.montant), [form.montant]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const validate = () => {
    if (!form.motif.trim()) return "Motif obligatoire";
    if (!form.beneficiaire.trim()) return "Bénéficiaire obligatoire";
    if (!form.montant || Number.isNaN(Number(form.montant)) || Number(form.montant) <= 0) return "Montant invalide";
    if (form.require_docs && (!docs.files || docs.files.length === 0)) return "Veuillez joindre au moins un document.";

    if (
      form.require_docs &&
      docs.files?.length &&
      String(docs.type_document).toLowerCase() === "autre" &&
      !docsTypeAutre.trim()
    ) {
      return "Veuillez préciser le type de document (Autre).";
    }

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
        beneficiaire: form.beneficiaire.trim(),
        remarque: form.remarque?.trim() || null,
        conditions_paiement_mode: form.conditions_paiement_mode,
        paiement_immediat: !!form.paiement_immediat,
      };

      const res = await updateDemande(demande.uuid || demande.id, payload);
      if (!res?.success) throw new Error(res?.message || "Modification échouée");

      if (canEditAll && form.require_docs && docs.files?.length) {
        const typeDocumentToSend =
          String(docs.type_document).toLowerCase() === "autre"
            ? `autre:${docsTypeAutre.trim()}`
            : docs.type_document;

        await uploadManyDocuments({
          files: docs.files,
          demande_id: demande.id,
          type_document: typeDocumentToSend,
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
              {canEditAll
                ? "Tous les champs sont modifiables."
                : "La demande semble engagée; vous pouvez essayer, le serveur refusera si verrouillée."}
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
              <input value={form.motif} onChange={(e) => setField("motif", e.target.value)} className={fieldClass} />
            </Field>

            <Field label="Bénéficiaire">
              <input
                value={form.beneficiaire}
                onChange={(e) => setField("beneficiaire", e.target.value)}
                className={fieldClass}
              />
            </Field>

            <Field label="Montant">
              <input
                value={form.montant}
                onChange={(e) => setField("montant", e.target.value)}
                className={fieldClass}
                placeholder="Ex: 500000"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aperçu: {montantPreview} FCFA</p>
            </Field>

            <div />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Conditions de paiement">
              <select
                value={form.conditions_paiement_mode}
                onChange={(e) => setField("conditions_paiement_mode", e.target.value)}
                className={fieldClass}
              >
                <option value="100/100">100/100</option>
                <option value="70/30">70/30</option>
                <option value="50/50">50/50</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Change l’échéancier (possible seulement si la demande n’est pas encore engagée).
              </p>
            </Field>

            <Field label="Paiement immédiat">
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={!!form.paiement_immediat}
                  onChange={(e) => setField("paiement_immediat", e.target.checked)}
                />
                Oui
              </label>
            </Field>
          </div>

          <Field label="Description">
            <textarea rows={4} value={form.description} onChange={(e) => setField("description", e.target.value)} className={fieldClass} />
          </Field>

          <Field label="Remarque">
            <textarea rows={3} value={form.remarque} onChange={(e) => setField("remarque", e.target.value)} className={fieldClass} />
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setDocs((p) => ({ ...p, type_document: v }));
                      if (String(v).toLowerCase() !== "autre") setDocsTypeAutre("");
                    }}
                    className={fieldClass}
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {String(docs.type_document).toLowerCase() === "autre" ? (
                  <Field label="Préciser (Autre) *">
                    <input
                      value={docsTypeAutre}
                      onChange={(e) => setDocsTypeAutre(e.target.value)}
                      className={fieldClass}
                      placeholder="Ex: facture, note, justificatif..."
                    />
                  </Field>
                ) : null}

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
