import React, { useEffect, useMemo, useState } from "react";
import { createBonCommande } from "../../services/bonsCommande.service";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";
import DatePicker from "../../components/form/date-picker";

export default function CreateBonCommandeModal({ open, demande, onClose, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const initialItems = useMemo(() => {
    const items = Array.isArray(demande?.demande_items) ? demande.demande_items : [];
    return items.map((it) => ({
      designation: it.designation || "",
      quantite: it.quantite ?? 1,
      prix_unitaire: it.prix_unitaire ?? "",
      unite: it.unite ?? "",
    }));
  }, [demande?.demande_items]);

  const [form, setForm] = useState({
    fournisseur_id: "",
    date_commande: "",
    statut: "brouillon",
    items: [],
  });

  const [docs, setDocs] = useState({
    type_document: "bon_commande",
    files: [],
  });

  useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError("");
    setForm({
      fournisseur_id: demande?.fournisseur_id ? String(demande.fournisseur_id) : "",
      date_commande: new Date().toISOString().slice(0, 10),
      statut: "brouillon",
      items: initialItems.length ? initialItems : [{ designation: "", quantite: 1, prix_unitaire: "", unite: "" }],
    });
    setDocs({ type_document: "bon_commande", files: [] });
  }, [open, demande?.fournisseur_id, initialItems]);

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const setItem = (idx, key, value) => {
    setForm((p) => {
      const next = [...p.items];
      next[idx] = { ...next[idx], [key]: value };
      return { ...p, items: next };
    });
  };

  const addLine = () => {
    setForm((p) => ({
      ...p,
      items: [...p.items, { designation: "", quantite: 1, prix_unitaire: "", unite: "" }],
    }));
  };

  const removeLine = (idx) => {
    setForm((p) => ({
      ...p,
      items: p.items.filter((_, i) => i !== idx),
    }));
  };

  const validate = () => {
    if (!demande?.id) return "Demande introuvable";
    if (!Array.isArray(form.items) || form.items.length === 0) return "Au moins une ligne est requise";
    for (const [i, it] of form.items.entries()) {
      if (!String(it.designation || "").trim()) return `Ligne ${i + 1}: designation obligatoire`;
      const q = Number(it.quantite);
      if (!q || Number.isNaN(q) || q <= 0) return `Ligne ${i + 1}: quantite invalide`;
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

      const payload = {
        demande_id: demande.id,
        fournisseur_id: form.fournisseur_id ? Number(form.fournisseur_id) : null,
        date_commande: form.date_commande ? new Date(form.date_commande).toISOString() : null,
        statut: form.statut,
        items: form.items.map((it) => ({
          designation: String(it.designation).trim(),
          quantite: Number(it.quantite),
          prix_unitaire: it.prix_unitaire !== "" && it.prix_unitaire != null ? Number(it.prix_unitaire) : null,
          unite: it.unite ? String(it.unite).trim() : null,
        })),
      };

      const res = await createBonCommande(payload);
      if (!res?.success) throw new Error(res?.message || "Création bon de commande échouée");

      const bc = res?.data;
      const bcId = bc?.id;

      if (docs.files?.length) {
        if (!bcId) throw new Error("BC créé mais ID manquant (réponse backend invalide).");
        await uploadManyDocuments({
          files: docs.files,
          type_document: docs.type_document,
          bon_commande_id: bcId,
        });
      }

      onCreated?.(bc);
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
      className="w-full max-w-4xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
    >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Nouveau bon de commande</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Demande: <span className="font-mono text-xs">{demande?.uuid || "-"}</span>
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Fournisseur ID (optionnel)">
              <input value={form.fournisseur_id} onChange={(e) => setForm((p) => ({ ...p, fournisseur_id: e.target.value }))} className={fieldClass} />
            </Field>
            <Field label="Date commande">
              <DatePicker
                id="bc-date-commande"
                placeholder="YYYY-MM-DD"
                defaultDate={form.date_commande || undefined}
                onChange={(_, dateStr) => setForm((p) => ({ ...p, date_commande: dateStr }))}
              />
            </Field>
            <Field label="Statut">
              <select value={form.statut} onChange={(e) => setForm((p) => ({ ...p, statut: e.target.value }))} className={fieldClass}>
                <option value="brouillon">brouillon</option>
                <option value="emis">emis</option>
              </select>
            </Field>
          </div>

          <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Lignes (items)</div>
              <button type="button" onClick={addLine} className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800">
                Ajouter ligne
              </button>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left bg-gray-50 dark:bg-gray-950">
                  <tr>
                    <th className="px-3 py-2">Désignation</th>
                    <th className="px-3 py-2">Qté</th>
                    <th className="px-3 py-2">PU</th>
                    <th className="px-3 py-2">Unité</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => (
                    <tr key={idx} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-3 py-2">
                        <input value={it.designation} onChange={(e) => setItem(idx, "designation", e.target.value)} className={fieldClass} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.quantite} onChange={(e) => setItem(idx, "quantite", e.target.value)} className={fieldClass} />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.prix_unitaire} onChange={(e) => setItem(idx, "prix_unitaire", e.target.value)} className={fieldClass} placeholder="Optionnel" />
                      </td>
                      <td className="px-3 py-2">
                        <input value={it.unite} onChange={(e) => setItem(idx, "unite", e.target.value)} className={fieldClass} placeholder="Optionnel" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => removeLine(idx)} className="px-3 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800">
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
            <div className="text-sm font-medium text-gray-800 dark:text-white/90">Documents (optionnel)</div>
            <div className="grid grid-cols-1 gap-3 mt-3 sm:grid-cols-3">
              <Field label="Type document">
                <select
                  value={docs.type_document}
                  onChange={(e) => setDocs((p) => ({ ...p, type_document: e.target.value }))}
                  className={fieldClass}
                >
                  <option value="bon_commande">bon_commande</option>
                </select>
              </Field>
              <Field label="Fichiers">
                <input
                  type="file"
                  multiple
                  onChange={(e) => setDocs((p) => ({ ...p, files: Array.from(e.target.files || []) }))}
                  className={fieldClass}
                />
              </Field>
              <Field label="Résumé">
                <div className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:bg-gray-950 dark:border-gray-800">
                  {docs.files?.length ? `${docs.files.length} fichier(s)` : "Aucun"}
                </div>
              </Field>
            </div>
          </div>

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
