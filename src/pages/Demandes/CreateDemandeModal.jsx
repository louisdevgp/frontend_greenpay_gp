import React, { useEffect, useMemo, useState } from "react";
import { createDemande } from "../../services/demandes.services";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";

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
    conditions_paiement_mode: "100/100",
    paiement_immediat: false,
    require_docs: false,
  });

  const [items, setItems] = useState([
    {
      designation: "",
      quantite: "1",
      prix_unitaire: "",
      unite: "",
      specifications: "",
    },
  ]);

  const [docs, setDocs] = useState({
    type_document: "proforma",
    files: [],
  });

  const [docsTypeAutre, setDocsTypeAutre] = useState("");

  const itemsTotal = useMemo(() => {
    const sum = (items || []).reduce((acc, it) => {
      const q = Number(it?.quantite);
      const pu = Number(it?.prix_unitaire);
      const line = (Number.isFinite(q) ? q : 0) * (Number.isFinite(pu) ? pu : 0);
      return acc + (Number.isFinite(line) ? line : 0);
    }, 0);
    return Number.isFinite(sum) ? sum : 0;
  }, [items]);

  const hasPricedItems = useMemo(() => {
    return (items || []).some((it) => String(it?.prix_unitaire ?? "").trim() !== "");
  }, [items]);

  const montantNum = useMemo(() => {
    const n = Number(form.montant);
    return Number.isNaN(n) ? 0 : n;
  }, [form.montant]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  // ✅ Si l'utilisateur saisit des PU, on aligne automatiquement le montant sur le total des items.
  useEffect(() => {
    if (!hasPricedItems) return;
    const rounded = Math.round(itemsTotal);
    setForm((p) => {
      const current = Number(p.montant);
      if (Number.isFinite(current) && Math.round(current) === rounded) return p;
      return { ...p, montant: String(rounded) };
    });
  }, [hasPricedItems, itemsTotal]);

  const validate = () => {
    if (!form.motif.trim()) return "Motif obligatoire";
    if (!form.beneficiaire.trim()) return "Bénéficiaire obligatoire";
    if (!form.montant || Number.isNaN(Number(form.montant)) || Number(form.montant) <= 0) return "Montant invalide";

    const effectiveItems = (items || [])
      .map((it) => ({
        designation: String(it?.designation || "").trim(),
        quantite: String(it?.quantite ?? "").trim(),
        prix_unitaire: String(it?.prix_unitaire ?? "").trim(),
        unite: String(it?.unite || "").trim(),
        specifications: String(it?.specifications || "").trim(),
      }))
      .filter((it) => it.designation || it.prix_unitaire || it.unite || it.specifications);

    for (const it of effectiveItems) {
      if (!it.designation) return "Chaque ligne doit avoir une désignation";
      const q = Number(it.quantite || 1);
      if (!Number.isFinite(q) || q <= 0) return "Quantité invalide sur une ligne";
      if (it.prix_unitaire) {
        const pu = Number(it.prix_unitaire);
        if (!Number.isFinite(pu) || pu < 0) return "Prix unitaire invalide sur une ligne";
      }
    }

    if (hasPricedItems) {
      const diff = Math.abs(Number(form.montant) - itemsTotal);
      if (!Number.isFinite(diff) || diff > 0.01) {
        return `Le montant doit être égal au total des items (${formatMoney(itemsTotal)} FCFA).`;
      }
    }

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
      conditions_paiement_mode: "100/100",
      paiement_immediat: false,
      require_docs: false,
    });
    setDocs({ type_document: "proforma", files: [] });
    setDocsTypeAutre("");
    setItems([
      {
        designation: "",
        quantite: "1",
        prix_unitaire: "",
        unite: "",
        specifications: "",
      },
    ]);
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

      const cleanedItems = (items || [])
        .map((it) => ({
          designation: String(it?.designation || "").trim(),
          quantite: it?.quantite === "" || it?.quantite == null ? 1 : Number(it.quantite),
          prix_unitaire: it?.prix_unitaire === "" || it?.prix_unitaire == null ? null : Number(it.prix_unitaire),
          unite: String(it?.unite || "").trim() || null,
          specifications: String(it?.specifications || "").trim() || null,
        }))
        .filter((it) => it.designation || it.prix_unitaire != null || it.unite || it.specifications)
        .map((it) => ({
          ...it,
          designation: it.designation,
          quantite: Number.isFinite(Number(it.quantite)) ? Number(it.quantite) : 1,
          prix_unitaire: it.prix_unitaire == null || Number.isFinite(Number(it.prix_unitaire)) ? it.prix_unitaire : null,
          total_ligne:
            it.prix_unitaire != null && Number.isFinite(Number(it.quantite))
              ? Number(it.quantite) * Number(it.prix_unitaire)
              : null,
        }));

      const montantToSend = hasPricedItems ? String(Math.round(itemsTotal)) : String(Number(form.montant));

      const payload = {
        motif: form.motif.trim(),
        description: form.description?.trim() || null,
        montant: montantToSend,
        devise: form.devise || null,
        beneficiaire: form.beneficiaire.trim(),
        remarque: form.remarque?.trim() || null,
        conditions_paiement_mode: form.conditions_paiement_mode,
        paiement_immediat: !!form.paiement_immediat,
        items: cleanedItems.length ? cleanedItems : undefined,
      };

      const res = await createDemande(payload);
      if (!res?.success) throw new Error(res?.message || "Création demande échouée");

      const demande = res.data;

      if (form.require_docs) {
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

      onCreated?.(demande);
      close();
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={close}
      showCloseButton={false}
      className="w-[99vw] max-w-none h-[92vh] max-h-[92vh] overflow-hidden rounded-2xl border border-gray-200 shadow-xl dark:border-gray-800"
    >
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouvelle demande</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Créer + joindre documents si require_docs.</p>
            </div>
            <button
              type="button"
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
              onClick={close}
            >
              Fermer
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {error ? (
              <div className="px-4 py-3 mb-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <form
              id="create-demande-form"
              onSubmit={onSubmit}
              className="grid gap-4 md:[grid-template-columns:0.9fr_1.4fr]"
            >
          <div className="space-y-4 min-h-0">
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
                  disabled={hasPricedItems}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Aperçu: {formatMoney(montantNum)} FCFA</p>
                {hasPricedItems ? (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Total items: <span className="font-medium">{formatMoney(itemsTotal)} FCFA</span> (montant auto)
                  </p>
                ) : null}
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Conditions de paiement">
                <select
                  value={form.conditions_paiement_mode}
                  onChange={(e) => setField("conditions_paiement_mode", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                >
                  <option value="100/100">100/100</option>
                  <option value="70/30">70/30</option>
                  <option value="50/50">50/50</option>
                </select>
              </Field>

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
                  Joindre maintenant
                </label>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>

            <Field label="Remarque">
              <textarea
                value={form.remarque}
                onChange={(e) => setField("remarque", e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              />
            </Field>
          </div>

          <div className="space-y-4 min-h-0">
            <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800 flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-800 dark:text-white/90">Lignes (items)</div>
                <button
                  type="button"
                  onClick={() =>
                    setItems((p) => [
                      ...(p || []),
                      { designation: "", quantite: "1", prix_unitaire: "", unite: "", specifications: "" },
                    ])
                  }
                  className="px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950"
                >
                  Ajouter
                </button>
              </div>

              <div className="mt-3 overflow-x-auto overflow-y-auto max-h-[45vh] md:max-h-[55vh] min-h-0">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="sticky top-0 z-10 text-left bg-gray-50 dark:bg-gray-950">
                    <tr>
                      <th className="px-3 py-2">Désignation</th>
                      <th className="px-3 py-2">Qté</th>
                      <th className="px-3 py-2">PU</th>
                      <th className="px-3 py-2">Unité</th>
                      <th className="px-3 py-2">Spécifications</th>
                      <th className="px-3 py-2 text-right">Suppr.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items || []).map((it, idx) => (
                      <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="px-3 py-2">
                          <input
                            value={it.designation}
                            onChange={(e) =>
                              setItems((p) =>
                                p.map((x, i) => (i === idx ? { ...x, designation: e.target.value } : x))
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                            placeholder="Article / prestation"
                          />
                        </td>
                        <td className="px-3 py-2 w-[110px]">
                          <input
                            value={it.quantite}
                            onChange={(e) =>
                              setItems((p) => p.map((x, i) => (i === idx ? { ...x, quantite: e.target.value } : x)))
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                            placeholder="1"
                          />
                        </td>
                        <td className="px-3 py-2 w-[150px]">
                          <input
                            value={it.prix_unitaire}
                            onChange={(e) =>
                              setItems((p) =>
                                p.map((x, i) => (i === idx ? { ...x, prix_unitaire: e.target.value } : x))
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                            placeholder="Ex: 50000"
                          />
                        </td>
                        <td className="px-3 py-2 w-[140px]">
                          <input
                            value={it.unite}
                            onChange={(e) =>
                              setItems((p) => p.map((x, i) => (i === idx ? { ...x, unite: e.target.value } : x)))
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                            placeholder="pcs, lot..."
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            value={it.specifications}
                            onChange={(e) =>
                              setItems((p) =>
                                p.map((x, i) => (i === idx ? { ...x, specifications: e.target.value } : x))
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                            placeholder="Optionnel"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                            disabled={(items || []).length <= 1}
                            className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:opacity-60 dark:border-gray-800"
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {form.require_docs ? (
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
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
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
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        placeholder="Ex: facture, note, justificatif..."
                      />
                    </Field>
                  ) : null}

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
          </div>
            </form>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
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
              form="create-demande-form"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
            >
              {submitting ? "Traitement..." : "Créer"}
            </button>
          </div>
        </div>
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
