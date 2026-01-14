import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function CreateDemande() {
  const nav = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState("form"); // form | done

  const [form, setForm] = useState({
    motif: "",
    description: "",
    montant: "",
    devise: "XOF",
    beneficiaire: "",
    remarque: "",
    conditions_paiement_mode: "100/100",
    paiement_immediat: false,
    require_docs: false, // ✅
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

  const [createdDemande, setCreatedDemande] = useState(null);

  const montantNum = useMemo(() => {
    const n = Number(form.montant);
    return Number.isNaN(n) ? 0 : n;
  }, [form.montant]);

  const itemsTotal = useMemo(() => {
    const sum = (items || []).reduce((acc, it) => {
      const q = Number(it?.quantite);
      const pu = Number(it?.prix_unitaire);
      const line = (Number.isFinite(q) ? q : 0) * (Number.isFinite(pu) ? pu : 0);
      return acc + (Number.isFinite(line) ? line : 0);
    }, 0);
    return Number.isFinite(sum) ? sum : 0;
  }, [items]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

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

      // 1) create demande
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

      const payload = {
        motif: form.motif.trim(),
        description: form.description?.trim() || null,
        montant: String(Number(form.montant)),
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
      setCreatedDemande(demande);

      // 2) upload docs (si demandé)
      if (form.require_docs) {
        const typeDocumentToSend =
          String(docs.type_document).toLowerCase() === "autre"
            ? `autre:${docsTypeAutre.trim()}`
            : docs.type_document;

        const up = await uploadManyDocuments({
          files: docs.files,
          demande_id: demande.id,
          type_document: typeDocumentToSend,
        });

        // si une upload fail, ton api renverra success false -> throw
        // ici on fait simple : si ça passe, ok
        void up;
      }

      setStep("done");
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Demande créée ✅</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          UUID: <span className="font-mono">{createdDemande?.uuid}</span>
        </p>

        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={() => nav(`/demandes/${createdDemande?.uuid}`)}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900"
          >
            Aller au détail
          </button>

          <button
            type="button"
            onClick={() => nav("/demandes/my")}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Retour liste
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Nouvelle demande</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Créer la demande et joindre les documents si nécessaire.</p>
        </div>

        <button
          type="button"
          onClick={() => nav(-1)}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
        >
          Retour
        </button>
      </div>

      {error ? (
        <div className="px-4 py-3 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="p-5 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800 space-y-4">
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
              placeholder="Ex: 500000"
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

        <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
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

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left bg-gray-50 dark:bg-gray-950">
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
                          setItems((p) => p.map((x, i) => (i === idx ? { ...x, designation: e.target.value } : x)))
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        placeholder="Article / prestation"
                      />
                    </td>
                    <td className="px-3 py-2 w-[110px]">
                      <input
                        value={it.quantite}
                        onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, quantite: e.target.value } : x)))}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        placeholder="1"
                      />
                    </td>
                    <td className="px-3 py-2 w-[150px]">
                      <input
                        value={it.prix_unitaire}
                        onChange={(e) =>
                          setItems((p) => p.map((x, i) => (i === idx ? { ...x, prix_unitaire: e.target.value } : x)))
                        }
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        placeholder="Ex: 50000"
                      />
                    </td>
                    <td className="px-3 py-2 w-[140px]">
                      <input
                        value={it.unite}
                        onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, unite: e.target.value } : x)))}
                        className="w-full px-2 py-1 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                        placeholder="pcs, lot..."
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={it.specifications}
                        onChange={(e) =>
                          setItems((p) => p.map((x, i) => (i === idx ? { ...x, specifications: e.target.value } : x)))
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

          <div className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Total items (indicatif): <span className="font-medium">{formatMoney(itemsTotal)} FCFA</span>
          </div>
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

          <Field label="Joindre des documents maintenant ?">
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

        {/* ✅ Upload section conditionnelle */}
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
                    <option key={t.value} value={t.value}>{t.label}</option>
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

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            {submitting ? "Traitement..." : "Créer la demande"}
          </button>
        </div>
      </form>
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
