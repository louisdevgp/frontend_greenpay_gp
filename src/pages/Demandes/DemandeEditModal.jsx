import React, { useState, useMemo } from "react";
import { updateDemande } from "../../services/demandes.services";
import { Modal } from "../../components/ui/modal";
import { emitToast } from "../../services/toastBus";
import { formatMoney, formatDateTime } from "../../utils/formatUtils";
import FullscreenLoader from "../../components/common/FullScreenLoader";

function round2(v) {
  return Math.round(Number(v) * 100) / 100;
}

function normalizeConditionSource(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (v === "DAF") return "DAF";
  if (v === "DEMANDEUR") return "DEMANDEUR";
  return null;
}

function Field({ label, children, error }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}

function isItemActive(it) {
  const designation = String(it?.designation || "").trim();
  const unite = String(it?.unite || "").trim();
  const qRaw = it?.quantite;
  const qStr = qRaw !== undefined && qRaw !== null ? String(qRaw).trim() : "";
  const puStr = String(it?.prix_unitaire ?? "").trim();
  const hasQty = qStr !== "" && qStr !== "1";
  return designation || unite || hasQty || puStr;
}

function buildInitialConditions(demande) {
  const list = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
  const totalRaw = demande?.montant_net != null ? demande.montant_net : demande?.montant;
  const total = Number(totalRaw) || 0;
  const demandeur = list.filter((c) => normalizeConditionSource(c?.source) === "DEMANDEUR");
  const mapped = demandeur.map((c, idx) => {
    const pct =
      c?.pourcentage != null
        ? Number(c.pourcentage)
        : total > 0 && c?.montant_prevu != null
          ? (Number(c.montant_prevu) / total) * 100
          : null;
    const pctStr = Number.isFinite(pct) ? String(Math.round(pct * 100) / 100) : "";
    return {
      label: String(c?.label || `Tranche ${idx + 1}`),
      pourcentage: pctStr,
      condition_texte: c?.condition_texte ? String(c.condition_texte) : "",
    };
  });
  return mapped.length ? mapped : [{ label: "", pourcentage: "", condition_texte: "" }];
}

export default function DemandeEditModal({ open, onClose, demande, onSaved }) {
  const [form, setForm] = useState(() => {
    if (!demande) return null;
    return {
      motif: demande.motif || "",
      description: demande.description || "",
      montant: String(demande.montant || ""),
      devise: demande.devise || "FCFA",
      beneficiaire: demande.beneficiaire || "",
      remarque: demande.remarque || "",
      items: (demande.demande_items || []).map((it) => ({
        id: it.id,
        designation: it.designation || "",
        quantite: String(it.quantite || "1"),
        prix_unitaire: it.prix_unitaire ? String(it.prix_unitaire) : "",
        unite: it.unite || "",
      })),
      remise_type: demande.remise_type || "",
      remise_valeur: demande.remise_valeur ? String(demande.remise_valeur) : "",
    };
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [conditions, setConditions] = useState(() => buildInitialConditions(demande));

  const itemsTotal = useMemo(() => {
    if (!form) return 0;
    return form.items.reduce((acc, it) => {
      const q = Number(it?.quantite || 1);
      const pu = Number(it?.prix_unitaire || 0);
      const lineTotal = q * pu;
      return acc + (Number.isFinite(lineTotal) ? lineTotal : 0);
    }, 0);
  }, [form]);

  const hasPricedItems = useMemo(() => {
    if (!form) return false;
    return form.items.some((it) => String(it?.prix_unitaire || "").trim() !== "");
  }, [form]);

  const montantNum = useMemo(() => {
    if (!form) return 0;
    const n = Number(form.montant);
    return Number.isFinite(n) ? n : 0;
  }, [form]);

  const montantBrutEffective = useMemo(() => {
    if (!form) return 0;
    const brut = hasPricedItems ? Math.round(itemsTotal) : montantNum;
    return Number.isFinite(brut) ? brut : 0;
  }, [form, hasPricedItems, itemsTotal, montantNum]);
  const montantInputValue = hasPricedItems ? String(montantBrutEffective) : form?.montant || "";

  const remiseType = form?.remise_type || "";
  const remiseValeurNum = useMemo(() => {
    if (!form) return 0;
    const n = Number(form.remise_valeur);
    return Number.isFinite(n) ? n : 0;
  }, [form]);

  const remiseMontant = useMemo(() => {
    if (!form) return 0;
    if (!remiseType || !remiseValeurNum) return 0;
    if (remiseType === "montant") return remiseValeurNum;
    if (remiseType === "pourcentage") return montantBrutEffective * (remiseValeurNum / 100);
    return 0;
  }, [form, remiseType, remiseValeurNum, montantBrutEffective]);

  const montantNet = useMemo(() => {
    if (!form) return 0;
    const brut = montantBrutEffective;
    const remise = remiseMontant;
    const net = brut - remise;
    return Number.isFinite(net) ? net : 0;
  }, [form, montantBrutEffective, remiseMontant]);

  const setField = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const setItem = (index, field, value) => {
    setForm((p) => ({
      ...p,
      items: p.items.map((it, idx) => (idx === index ? { ...it, [field]: value } : it)),
    }));
  };

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { label: "", pourcentage: "", condition_texte: "" }
    ]);
  };

  const removeCondition = (index) => {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const setCondition = (index, field, value) => {
    setConditions((prev) =>
      prev.map((cond, idx) =>
        idx === index ? { ...cond, [field]: value } : cond
      )
    );
  };

  const addItem = () => {
    setForm((p) => ({
      ...p,
      items: [...p.items, { designation: "", quantite: "1", prix_unitaire: "", unite: "" }],
    }));
  };

  const removeItem = (index) => {
    if (form.items.length <= 1) return;
    setForm((p) => ({
      ...p,
      items: p.items.filter((_, idx) => idx !== index),
    }));
  };

  const validate = () => {
    const newErrors = {};

    if (!form.motif.trim()) newErrors.motif = "Le motif est requis";
    const montantCheck = hasPricedItems ? montantBrutEffective : Number(form.montant);
    if (!Number.isFinite(montantCheck) || montantCheck <= 0) newErrors.montant = "Montant invalide";
    if (!form.beneficiaire.trim()) newErrors.beneficiaire = "Le bénéficiaire est requis";

    // Validation des items
    form.items.forEach((it, idx) => {
      if (!isItemActive(it)) return;
      if (!it.designation.trim()) newErrors[`item_${idx}_designation`] = "La désignation est requise";
      const q = Number(it.quantite);
      if (!q || Number.isNaN(q) || q <= 0) newErrors[`item_${idx}_quantite`] = "Quantité invalide";
      if (it.prix_unitaire && (Number.isNaN(Number(it.prix_unitaire)) || Number(it.prix_unitaire) < 0)) {
        newErrors[`item_${idx}_prix_unitaire`] = "Prix unitaire invalide";
      }
    });

    // Validation des conditions de paiement
    let sumPct = 0;
    let hasActiveConditions = false;
    conditions.forEach((c, idx) => {
      const label = String(c.label || "").trim();
      const pctRaw = String(c.pourcentage || "").trim();
      const txt = String(c.condition_texte || "").trim();
      const isActive = label || pctRaw || txt;
      if (!isActive) return;
      hasActiveConditions = true;

      const pct = Number(c.pourcentage);
      if (!label) newErrors[`condition_${idx}_label`] = "Libelle requis";
      if (!Number.isFinite(pct) || pct <= 0) {
        newErrors[`condition_${idx}_pourcentage`] = "Pourcentage requis";
      } else {
        sumPct += pct;
      }
    });

    if (hasActiveConditions && Math.abs(sumPct - 100) > 0.01) {
      newErrors.conditions = "La somme des pourcentages doit etre 100%";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const reset = () => {
    if (demande) {
      setForm({
        motif: demande.motif || "",
        description: demande.description || "",
        montant: String(demande.montant || ""),
        devise: demande.devise || "FCFA",
        beneficiaire: demande.beneficiaire || "",
        remarque: demande.remarque || "",
        items: (demande.demande_items || []).map((it) => ({
          id: it.id,
          designation: it.designation || "",
          quantite: String(it.quantite || "1"),
          prix_unitaire: it.prix_unitaire ? String(it.prix_unitaire) : "",
          unite: it.unite || "",
        })),
        remise_type: demande.remise_type || "",
        remise_valeur: demande.remise_valeur ? String(demande.remise_valeur) : "",
      });
    }
    setConditions(buildInitialConditions(demande));
    setErrors({});
    setLoading(false);
  };

  const close = () => {
    if (loading) return;
    reset();
    onClose();
  };

  const submit = async (e) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      const customConditions = conditions
        .filter((c) => String(c.label || "").trim() && String(c.pourcentage || "").trim())
        .map((c) => ({
          label: String(c.label || "").trim(),
          pourcentage: Number(c.pourcentage),
          condition_texte: String(c.condition_texte || "").trim() || null,
        }));

      const payload = {
        motif: form.motif.trim(),
        description: form.description.trim() || null,
        montant: montantBrutEffective, // On envoie le montant brut (net calculé côté backend)
        remise_type: remiseType || null,
        remise_valeur: remiseType ? remiseValeurNum : null,
        devise: form.devise,
        beneficiaire: form.beneficiaire.trim(),
        remarque: form.remarque.trim(),
        items: form.items
          .map((it) => ({
            ...(it.id ? { id: it.id } : {}), // Inclure l'id seulement s'il existe (update)
            designation: it.designation.trim(),
            quantite: Number(it.quantite),
            prix_unitaire: it.prix_unitaire ? Number(it.prix_unitaire) : null,
            unite: it.unite.trim() || null,
          }))
          .filter((it) => it.designation), // Supprimer les lignes vides
        ...(customConditions.length ? { conditions_paiement_custom: customConditions } : {}),
      };

      const res = await updateDemande(demande.id, payload);
      if (res?.success) {
        emitToast("Demande mise à jour avec succès", "success");
        onSaved?.(res.data);
        close();
      } else {
        throw new Error(res?.message || "Erreur mise à jour demande");
      }
    } catch (err) {
      emitToast(err?.message || "Erreur inconnue", "error");
    } finally {
      setLoading(false);
    }
  };

  if (!open || !demande || !form) return null;

  return (
    <Modal
      isOpen={open}
      onClose={close}
      showCloseButton={false}
      className="w-full max-w-4xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
    >
      <FullscreenLoader show={loading} label="Traitement..." />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">Modifier la demande</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Modifiez les détails de la demande.</p>
        </div>

        <button
          type="button"
          disabled={loading}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={close}
        >
          Fermer
        </button>
      </div>

      {errors._global ? (
        <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
          {errors._global}
        </div>
      ) : null}

      <form onSubmit={submit} className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white/90 mb-4">Informations générales</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Motif *" error={errors.motif}>
              <input
                type="text"
                value={form.motif}
                onChange={(e) => setField("motif", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                placeholder="Objet de la demande"
              />
            </Field>

            <Field label="Bénéficiaire *" error={errors.beneficiaire}>
              <input
                type="text"
                value={form.beneficiaire}
                onChange={(e) => setField("beneficiaire", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                placeholder="Nom du bénéficiaire"
              />
            </Field>
          </div>

          <Field label="Description *" error={errors.description}>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Détails complets de la demande"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Devise" error={errors.devise}>
              <select
                value={form.devise}
                onChange={(e) => setField("devise", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              >
                <option value="FCFA">FCFA</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </Field>

          </div>

          <Field label="Observations" error={errors.remarque}>
            <textarea
              value={form.remarque}
              onChange={(e) => setField("remarque", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder="Remarques additionnelles"
            />
          </Field>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white/90 mb-4">Détail des articles</h2>

          {form.items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 gap-3 mb-3 p-3 border border-gray-200 rounded-lg dark:border-gray-800">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-5">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Désignation *</label>
                  <input
                    type="text"
                    value={it.designation}
                    onChange={(e) => setItem(idx, "designation", e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                    placeholder="Article"
                  />
                  {errors[`item_${idx}_designation`] ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`item_${idx}_designation`]}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Qté</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={it.quantite}
                    onChange={(e) => setItem(idx, "quantite", e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                  />
                  {errors[`item_${idx}_quantite`] ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`item_${idx}_quantite`]}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">PU (facultatif)</label>
                  <input
                    type="number"
                    step="any"
                    value={it.prix_unitaire}
                    onChange={(e) => setItem(idx, "prix_unitaire", e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                    placeholder="0.00"
                  />
                  {errors[`item_${idx}_prix_unitaire`] ? (
                    <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`item_${idx}_prix_unitaire`]}</p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-gray-500 dark:text-gray-400">Unité</label>
                  <input
                    type="text"
                    value={it.unite}
                    onChange={(e) => setItem(idx, "unite", e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                    placeholder="ex: unité"
                  />
                </div>
              </div>

              {it.prix_unitaire && (
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    Total: {formatMoney(Number(it.prix_unitaire || 0) * Number(it.quantite || 1))} {form.devise}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => removeItem(idx)}
                  disabled={form.items.length <= 1}
                  className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50 dark:hover:bg-red-950/30 dark:text-red-400"
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addItem}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950/30"
          >
            + Ajouter un article
          </button>

          {hasPricedItems && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg dark:bg-gray-900/30">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Total items: <span className="font-medium">{formatMoney(itemsTotal)} {form.devise}</span> (montant auto)
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white/90 mb-4">Conditions de paiement</h2>

          {errors.conditions ? (
            <p className="mb-3 text-xs text-red-600 dark:text-red-400">{errors.conditions}</p>
          ) : null}

          {conditions.map((condition, idx) => {
            const pct = Number(condition.pourcentage);
            const montantAuto =
              Number.isFinite(pct) && pct > 0 ? round2((montantNet * pct) / 100) : 0;
            return (
              <div
                key={idx}
                className="grid grid-cols-1 gap-3 mb-3 p-3 border border-gray-200 rounded-lg dark:border-gray-800"
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-4">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Libelle *</label>
                    <input
                      type="text"
                      value={condition.label}
                      onChange={(e) => setCondition(idx, "label", e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                      placeholder="ex: Acompte 30%"
                    />
                    {errors[`condition_${idx}_label`] ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`condition_${idx}_label`]}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">%</label>
                    <input
                      type="number"
                      step="any"
                      value={condition.pourcentage}
                      onChange={(e) => setCondition(idx, "pourcentage", e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                      placeholder="0"
                    />
                    {errors[`condition_${idx}_pourcentage`] ? (
                      <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[`condition_${idx}_pourcentage`]}</p>
                    ) : null}
                  </div>

                  <div className="sm:col-span-6">
                    <label className="block text-xs text-gray-500 dark:text-gray-400">Condition (optionnel)</label>
                    <input
                      type="text"
                      value={condition.condition_texte}
                      onChange={(e) => setCondition(idx, "condition_texte", e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-200 rounded outline-none dark:bg-gray-950 dark:border-gray-800"
                      placeholder="Ex: a la reception"
                    />
                  </div>
                </div>

                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Montant prevu: {formatMoney(montantAuto)} {form.devise}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeCondition(idx)}
                    disabled={conditions.length <= 1}
                    className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded disabled:opacity-50 dark:hover:bg-red-950/30 dark:text-red-400"
                  >
                    Retirer
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addCondition}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-950/30"
          >
            + Ajouter une condition
          </button>
        </div>

        <div className="p-4 bg-white border border-gray-200 rounded-xl dark:bg-gray-900 dark:border-gray-800">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white/90 mb-4">Montant & Remise</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Montant" error={errors.montant}>
              <input
                type="number"
                step="any"
                value={montantInputValue}
                onChange={(e) => setField("montant", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                placeholder="0.00"
                disabled={hasPricedItems} // Désactivé si les prix unitaires sont saisis
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Aperçu: {formatMoney(montantBrutEffective)} {form.devise}
              </p>
              {hasPricedItems && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                  Le montant est automatiquement aligné sur le total des items
                </p>
              )}
            </Field>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type de remise</label>
                <select
                  value={form.remise_type}
                  onChange={(e) => setField("remise_type", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                >
                  <option value="">Aucune remise</option>
                  <option value="montant">Montant fixe</option>
                  <option value="pourcentage">Pourcentage</option>
                </select>
              </div>

              {form.remise_type && (
                <Field label={form.remise_type === "montant" ? "Valeur de la remise (montant)" : "Valeur de la remise (%)"}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={form.remise_valeur}
                    onChange={(e) => setField("remise_valeur", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                    placeholder="0.00"
                  />
                </Field>
              )}
            </div>
          </div>

          {form.remise_type && form.remise_valeur && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg dark:bg-blue-950/30">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Brut {formatMoney(montantBrutEffective)} {form.devise} | Net {formatMoney(montantNet)} {form.devise}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Remise: -{formatMoney(remiseMontant)} {form.devise}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={close}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-gray-900"
          >
            {loading ? "Traitement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
