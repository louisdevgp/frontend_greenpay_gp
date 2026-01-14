import React, { useEffect, useMemo, useState } from "react";
import { createPaiement } from "../../services/paiements.service";
import { uploadManyDocuments } from "../../services/documents.service";
import { Modal } from "../../components/ui/modal";
import DatePicker from "../../components/form/date-picker";
import { getDemande } from "../../services/demandes.services";



const MOYENS = ["virement", "cheque", "especes", "mobile_money"];
const TYPE_PAIEMENT = [
  { value: "total", label: "Total" },
  { value: "partiel", label: "Partiel" },
];

function round2(v) {
  const n = Number(v);
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function amountsEqual(a, b, tolerance = 0.01) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.abs(na - nb) <= tolerance;
}

function deriveModeFromConditions(conds) {
  const list = Array.isArray(conds) ? conds : [];
  const pcts = list.map((c) => Number(c?.pourcentage)).filter((n) => Number.isFinite(n));
  if (pcts.length === 1 && amountsEqual(pcts[0], 100, 0.01)) return "100/100";
  if (pcts.length === 2) {
    const a = round2(pcts[0]);
    const b = round2(pcts[1]);
    if (amountsEqual(a, 70, 0.01) && amountsEqual(b, 30, 0.01)) return "70/30";
    if (amountsEqual(a, 50, 0.01) && amountsEqual(b, 50, 0.01)) return "50/50";
  }
  return null;
}

function formatMoney(v) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return String(v ?? "");
  return new Intl.NumberFormat("fr-FR").format(n);
}

export default function CreatePaiementModal({ open, onClose, demande, onCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [demandeResolved, setDemandeResolved] = useState(demande || null);
  const [demandeResolving, setDemandeResolving] = useState(false);

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

  const [docsTypeAutre, setDocsTypeAutre] = useState("");

  useEffect(() => {
    setDemandeResolved(demande || null);
  }, [demande]);

  useEffect(() => {
    let alive = true;
    const resolve = async () => {
      if (!open) return;

      const uuid = demande?.uuid || demande?.demande_uuid;
      const hasConditions = Array.isArray(demande?.conditions_paiement) && demande.conditions_paiement.length > 0;

      // When opening from list views, demande may be a light payload without conditions.
      if (!uuid || hasConditions) {
        setDemandeResolved(demande || null);
        return;
      }

      try {
        setDemandeResolving(true);
        const res = await getDemande(uuid);
        if (!alive) return;
        if (res?.success && res?.data) {
          setDemandeResolved(res.data);
        } else {
          setDemandeResolved(demande || null);
        }
      } catch {
        if (!alive) return;
        setDemandeResolved(demande || null);
      } finally {
        if (!alive) return;
        setDemandeResolving(false);
      }
    };

    resolve();
    return () => {
      alive = false;
    };
  }, [open, demande?.uuid, demande?.demande_uuid, demande?.conditions_paiement]);

  const demandeMontant = useMemo(() => Number(demandeResolved?.montant ?? 0), [demandeResolved?.montant]);

  const conditions = useMemo(() => {
    const list = Array.isArray(demandeResolved?.conditions_paiement) ? demandeResolved.conditions_paiement : [];
    return list.slice().sort((a, b) => Number(a?.id ?? 0) - Number(b?.id ?? 0));
  }, [demandeResolved?.conditions_paiement]);

  const unpaid = useMemo(() => {
    return conditions.filter((c) => !c?.paiement_id && String(c?.statut || "").toLowerCase() !== "paye");
  }, [conditions]);

  const paiementMode = useMemo(() => deriveModeFromConditions(conditions), [conditions]);
  const nextTranche = unpaid?.[0] || null;
  const remainingTotal = useMemo(() => {
    return round2(unpaid.reduce((acc, c) => acc + Number(c?.montant_prevu || 0), 0));
  }, [unpaid]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSubmitting(false);
    setForm((p) => ({
      ...p,
      type_paiement: "total",
      montant: remainingTotal ? String(remainingTotal) : (demandeMontant ? String(demandeMontant) : ""),
      date_paiement: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      moyen_paiement: "virement",
      reference_piece: "",
      compte_debite: "",
      commentaire: "",
      require_docs: true,
    }));
    setDocs({ type_document: "preuve_paiement", files: [] });
    setDocsTypeAutre("");
  }, [open, demandeMontant, remainingTotal]);

  const isTotal = form.type_paiement === "total";
  const isPartiel = form.type_paiement === "partiel";
  const partielAllowed = paiementMode !== "100/100";
  const expectedAmount = useMemo(() => {
    if (isTotal) return remainingTotal || demandeMontant;
    if (isPartiel) return nextTranche?.montant_prevu != null ? Number(nextTranche.montant_prevu) : null;
    return null;
  }, [isTotal, isPartiel, remainingTotal, demandeMontant, nextTranche]);

  useEffect(() => {
    if (!open) return;
    // Auto-fill montant selon les règles (montant exact attendu)
    if (expectedAmount != null && expectedAmount !== "") {
      setForm((p) => ({ ...p, montant: String(expectedAmount) }));
    }
  }, [expectedAmount, open]);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const close = () => {
    if (submitting) return;
    onClose?.();
  };

  const validate = () => {
    if (!demandeResolved?.id && !demandeResolved?.demande_id) return "Demande introuvable";
    if (!form.type_paiement) return "Type paiement obligatoire";
    if (!form.moyen_paiement) return "Moyen paiement obligatoire";

    const m = Number(form.montant);
    if (!m || Number.isNaN(m) || m <= 0) return "Montant invalide";

    // Règles conditions paiement
    if (paiementMode === "100/100" && String(form.type_paiement) === "partiel") {
      return "Condition 100/100 : paiement en une seule fois";
    }

    if (expectedAmount != null && !amountsEqual(m, expectedAmount)) {
      return `Montant attendu = ${expectedAmount}`;
    }

    if (!form.date_paiement) return "Date paiement obligatoire";

    if (form.require_docs && (!docs.files?.length)) {
      return "Veuillez joindre au moins un document";
    }

    if (
      form.require_docs &&
      docs.files?.length &&
      String(docs.type_document).toLowerCase() === "autre" &&
      !docsTypeAutre.trim()
    ) {
      return "Veuillez préciser le type de document (Autre)";
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
        demande_id: demandeResolved?.id ?? demandeResolved?.demande_id,
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
        const typeDocumentToSend =
          String(docs.type_document).toLowerCase() === "autre"
            ? `autre:${docsTypeAutre.trim()}`
            : docs.type_document;

        await uploadManyDocuments({
          files: docs.files,
          type_document: typeDocumentToSend,
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
            disabled={submitting}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Fermer
          </button>
        </div>

        {paiementMode ? (
          <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
            Conditions: <span className="font-medium">{paiementMode}</span>
            {unpaid?.length ? (
              <>
                {" — "}Restant: <span className="font-medium">{formatMoney(remainingTotal)} FCFA</span>
                {nextTranche?.montant_prevu != null ? (
                  <>
                    {" — "}Prochaine tranche: <span className="font-medium">{formatMoney(nextTranche.montant_prevu)} FCFA</span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {demandeResolving ? (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Chargement des conditions de paiement…</div>
        ) : null}

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
                {TYPE_PAIEMENT.filter((t) => (t.value === "partiel" ? partielAllowed : true)).map((t) => (
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
                disabled={isTotal || isPartiel}
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
                    onChange={(e) => {
                      const v = e.target.value;
                      setDocs((p) => ({ ...p, type_document: v }));
                      if (String(v).toLowerCase() !== "autre") setDocsTypeAutre("");
                    }}
                    className={fieldClass}
                  >
                    <option value="preuve_paiement">preuve_paiement</option>
                    <option value="recu">recu</option>
                    <option value="autre">autre</option>
                  </select>
                </Field>

                {String(docs.type_document).toLowerCase() === "autre" ? (
                  <Field label="Préciser (Autre)">
                    <input
                      value={docsTypeAutre}
                      onChange={(e) => setDocsTypeAutre(e.target.value)}
                      className={fieldClass}
                      placeholder="Ex: bordereau, avis de débit..."
                    />
                  </Field>
                ) : null}

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
