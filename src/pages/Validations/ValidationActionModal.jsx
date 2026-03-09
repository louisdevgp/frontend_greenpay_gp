import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiCornerUpLeft, FiX, FiXCircle } from "react-icons/fi";
import { approveValidation, rejectValidation, returnValidationForModification } from "../../services/validations.service";
import { Modal } from "../../components/ui/modal";
import FullscreenLoader from "../../components/common/FullScreenLoader";
import { emitToast } from "../../services/toastBus";
import { formatMoney } from "../../utils/formatUtils";

const DAF_CRITERE4_LABEL = import.meta.env.VITE_DAF_CRITERE4_LABEL || "Moyen de paiement";

function normalizeDafCritere4Input(value) {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (["true", "false", "1", "0", "oui", "non", "yes", "no"].includes(lower)) return "";
    return trimmed;
  }
  return "";
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeConditionSource(value) {
  if (!value) return "DEMANDEUR";
  const v = String(value).trim().toUpperCase();
  return v === "DAF" ? "DAF" : "DEMANDEUR";
}

function normalizeValidationStopRole(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  if (["DAF", "DGA", "DG"].includes(v)) return v;
  return null;
}

export default function ValidationActionModal({ open, mode, item, onClose, onDone }) {
  // mode: "approve" | "reject" | "return"
  const [commentaire, setCommentaire] = useState("");
  // On n'utilise plus les signatures
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const role = useMemo(() => String(item?.role_name || "").toUpperCase(), [item?.role_name]);
  const demande = item?.demandes_paiement || null;
  const isDaf = role === "DAF";
  const demandeurConditions = useMemo(() => {
    const list = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    return list.filter((c) => normalizeConditionSource(c?.source) === "DEMANDEUR");
  }, [demande?.conditions_paiement]);
  const dafExisting = useMemo(() => {
    const list = Array.isArray(demande?.conditions_paiement) ? demande.conditions_paiement : [];
    return list.filter((c) => normalizeConditionSource(c?.source) === "DAF");
  }, [demande?.conditions_paiement]);

  const [budgetPrevu, setBudgetPrevu] = useState(null); // null | boolean
  const [budgetDisponible, setBudgetDisponible] = useState(null); // null | boolean
  const [paiementImmediat, setPaiementImmediat] = useState(null); // null | boolean
  const [dafCritere4, setDafCritere4] = useState(""); // string (moyen de paiement)
  const [validationStopRole, setValidationStopRole] = useState("DG"); // DAF | DGA | DG
  const [dafConditionsChoice, setDafConditionsChoice] = useState("daf"); // "daf" | "demandeur"
  const [dafConditionsMode, setDafConditionsMode] = useState("100/100"); // 100/100 | 70/30 | 50/50 | custom
  const [dafConditions, setDafConditions] = useState([
    { label: "", pourcentage: "", condition_texte: "" },
  ]);

  const totalMontant = useMemo(() => {
    const raw = demande?.montant_net != null ? demande.montant_net : demande?.montant;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  }, [demande?.montant_net, demande?.montant]);

  const formatAmount = (value) =>
    Number.isFinite(Number(value)) ? `${formatMoney(Number(value))} FCFA` : "-";

  const computeConditionsPctSum = (conditions, total) => {
    const list = Array.isArray(conditions) ? conditions : [];
    let sum = 0;
    let hasAny = false;
    const totalNum = Number(total);

    for (const c of list) {
      const pct = Number(c?.pourcentage);
      if (Number.isFinite(pct)) {
        sum += pct;
        hasAny = true;
        continue;
      }
      const montant = Number(c?.montant_prevu);
      if (Number.isFinite(montant) && Number.isFinite(totalNum) && totalNum > 0) {
        sum += (montant / totalNum) * 100;
        hasAny = true;
      }
    }

    return { sum, hasAny };
  };

  const demandeurSumInfo = useMemo(() => {
    return computeConditionsPctSum(demandeurConditions, totalMontant);
  }, [demandeurConditions, totalMontant]);

  const demandeurSumValid =
    demandeurSumInfo.hasAny && Math.abs(Number(demandeurSumInfo.sum) - 100) <= 0.01;

  const customSumInfo = useMemo(() => {
    return computeConditionsPctSum(dafConditions, totalMontant);
  }, [dafConditions, totalMontant]);

  const customSumValid =
    customSumInfo.hasAny && Math.abs(Number(customSumInfo.sum) - 100) <= 0.01;

  const partsForMode = useMemo(() => {
    if (dafConditionsMode === "70/30") return [70, 30];
    if (dafConditionsMode === "50/50") return [50, 50];
    if (dafConditionsMode === "100/100") return [100];
    return [];
  }, [dafConditionsMode]);

  const title = useMemo(() => {
    if (mode === "approve") return "Valider la demande";
    if (mode === "reject") return "Rejeter la demande";
    return "Retourner pour modification";
  }, [mode]);

  const close = () => {
    if (submitting) return;
    setCommentaire("");
    setBudgetPrevu(null);
    setBudgetDisponible(null);
    setPaiementImmediat(null);
    setDafCritere4("");
    setValidationStopRole("DG");
    setDafConditionsChoice("daf");
    setDafConditionsMode("100/100");
    setDafConditions([{ label: "", pourcentage: "", condition_texte: "" }]);
    setError("");
    onClose?.();
  };

  // Pré-remplissage (utile si la demande a déjà une valeur)
  React.useEffect(() => {
    if (!open) return;
    if (!isDaf) return;
    setBudgetPrevu(demande?.budget_prevu === true ? true : demande?.budget_prevu === false ? false : null);
    setBudgetDisponible(demande?.budget_disponible === true ? true : demande?.budget_disponible === false ? false : null);
    setPaiementImmediat(demande?.paiement_immediat === true ? true : demande?.paiement_immediat === false ? false : null);
    setDafCritere4(normalizeDafCritere4Input(demande?.daf_critere4));
    setValidationStopRole(normalizeValidationStopRole(demande?.validation_stop_role) || "DG");
    if (dafExisting.length > 0) {
      setDafConditionsChoice("daf");
      setDafConditionsMode("custom");
      setDafConditions(
        dafExisting.map((c) => ({
          label: String(c?.label || ""),
          pourcentage: c?.pourcentage != null ? String(c.pourcentage) : "",
          condition_texte: c?.condition_texte ? String(c.condition_texte) : "",
        }))
      );
    } else {
      setDafConditionsChoice(demandeurConditions.length > 0 ? "demandeur" : "daf");
      setDafConditionsMode("100/100");
      setDafConditions([{ label: "", pourcentage: "", condition_texte: "" }]);
    }
  }, [
    open,
    isDaf,
    demande?.budget_prevu,
    demande?.budget_disponible,
    demande?.paiement_immediat,
    demande?.daf_critere4,
    demande?.validation_stop_role,
    dafExisting,
    demandeurConditions.length,
  ]);

  const addDafCondition = () => {
    setDafConditions((prev) => [
      ...prev,
      { label: "", pourcentage: "", condition_texte: "" },
    ]);
  };

  const removeDafCondition = (index) => {
    if (dafConditions.length <= 1) return;
    setDafConditions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const setDafCondition = (index, field, value) => {
    setDafConditions((prev) =>
      prev.map((c, idx) => (idx === index ? { ...c, [field]: value } : c))
    );
  };

  const copyDemandeurConditions = () => {
    if (!demandeurConditions.length) return;
    setDafConditionsChoice("daf");
    setDafConditionsMode("custom");
    setDafConditions(
      demandeurConditions.map((c, idx) => {
        const pct =
          c?.pourcentage != null
            ? Number(c.pourcentage)
            : totalMontant > 0 && c?.montant_prevu != null
              ? (Number(c.montant_prevu) / totalMontant) * 100
              : null;
        const pctStr = Number.isFinite(pct) ? String(Math.round(pct * 100) / 100) : "";
        return {
          label: String(c?.label || `Tranche ${idx + 1}`),
          pourcentage: pctStr,
          condition_texte: c?.condition_texte ? String(c.condition_texte) : "",
        };
      })
    );
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      const id = item?.id;
      if (!id) throw new Error("Validation ID manquant");

      const commentaireTrimmed = (commentaire || "").trim();
      if ((mode === "reject" || mode === "return") && !commentaireTrimmed) {
        throw new Error("Commentaire obligatoire");
      }

      let dafExtraPayload = {};
      if (mode === "approve" && isDaf) {
        if (budgetPrevu === null || budgetDisponible === null || paiementImmediat === null || !dafCritere4) {
          throw new Error("Controle DAF: renseigne Budget prevu, Budget disponible, Paiement immediat et Moyen de paiement");
        }

        const stopRoleNormalized = normalizeValidationStopRole(validationStopRole);
        if (!stopRoleNormalized) throw new Error("Categorie de validation invalide");

        if (paiementImmediat === false) {
          if (!commentaireTrimmed) throw new Error("Commentaire obligatoire si paiement non immediat");

          if (dafConditionsChoice === "demandeur") {
            if (!demandeurConditions.length) {
              throw new Error("Aucune condition de paiement du demandeur");
            }
            if (!demandeurSumValid) {
              throw new Error("Conditions du demandeur: la somme des pourcentages doit etre 100%");
            }
            dafExtraPayload = { conditions_paiement_use_demandeur: true };
          } else {
            if (dafConditionsMode === "custom") {
              const active = dafConditions.filter((c) => {
                const label = String(c.label || "").trim();
                const pct = String(c.pourcentage || "").trim();
                const txt = String(c.condition_texte || "").trim();
                return label || pct || txt;
              });
              if (!active.length) {
                throw new Error("Definir les conditions de paiement");
              }
              let sumPct = 0;
              const custom = active.map((c, idx) => {
                const label = String(c.label || "").trim();
                const pctNum = toNumber(c.pourcentage);
                if (!label) throw new Error(`Libelle requis (tranche ${idx + 1})`);
                if (pctNum == null || pctNum <= 0) throw new Error(`Pourcentage invalide (tranche ${idx + 1})`);
                sumPct += pctNum;
                return {
                  label,
                  pourcentage: pctNum,
                  condition_texte: String(c.condition_texte || "").trim() || null,
                };
              });
              if (Math.abs(sumPct - 100) > 0.01) {
                throw new Error("La somme des pourcentages doit etre 100%");
              }
              dafExtraPayload = { conditions_paiement_custom: custom };
            } else {
              dafExtraPayload = { conditions_paiement_mode: dafConditionsMode };
            }
          }
        }

        dafExtraPayload = { ...dafExtraPayload, validation_stop_role: stopRoleNormalized };
      }

      const res =
        mode === "approve"
          ? await approveValidation(id, {
              ...(commentaireTrimmed ? { commentaire: commentaireTrimmed } : {}),
              // Plus de signature_data_url
              ...(isDaf
                ? {
                    budget_prevu: !!budgetPrevu,
                    budget_disponible: !!budgetDisponible,
                    paiement_immediat: !!paiementImmediat,
                    daf_critere4: dafCritere4 ? String(dafCritere4).trim() : null,
                    ...dafExtraPayload, // Envoyer le moyen de paiement comme chaîne
                  }
                : {}),
            })
          : mode === "reject"
            ? await rejectValidation(id, { commentaire: commentaireTrimmed })
            : await returnValidationForModification(id, { commentaire: commentaireTrimmed });

      if (!res?.success) throw new Error(res?.message || "Action échouée");
      emitToast({
        variant: "success",
        message:
          mode === "approve"
            ? "Validation effectuée"
            : mode === "reject"
              ? "Demande rejetée"
              : "Demande retournée pour modification",
      });
      onDone?.();
      close();
    } catch (err) {
      const msg = err?.message || "Erreur inconnue";
      setError(msg);
      emitToast({ variant: "error", message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={close}
      showCloseButton={false}
      className="w-full max-w-xl rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
    >
        <FullscreenLoader show={submitting} label="Traitement..." />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {mode === "approve"
                ? "Ajouter un commentaire si besoin."
                : mode === "reject"
                  ? "Commentaire obligatoire pour le rejet."
                  : "Commentaire obligatoire (motif du retour)."}
            </p>
          </div>

          <button
            type="button"
            disabled={submitting}
            title="Fermer"
            aria-label="Fermer"
            className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={close}
          >
            <FiX />
          </button>
        </div>

        {error ? (
          <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {mode === "approve" && isDaf ? (
            <div className="p-4 border border-gray-200 rounded-xl dark:border-gray-800">
              <div className="text-sm font-medium text-gray-800 dark:text-white/90">Contrôle DAF</div>
              <div className="mt-2 grid grid-cols-1 gap-3">
                <YesNo
                  label="Prévu au budget ?"
                  value={budgetPrevu}
                  onChange={setBudgetPrevu}
                />
                <YesNo
                  label="Budget disponible ?"
                  value={budgetDisponible}
                  onChange={setBudgetDisponible}
                />
                <YesNo
                  label="Paiement immédiat ?"
                  value={paiementImmediat}
                  onChange={setPaiementImmediat}
                />
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">{DAF_CRITERE4_LABEL}</div>
                  <select
                    value={dafCritere4 || ""}
                    onChange={(e) => setDafCritere4(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="">Sélectionnez un moyen</option>
                    <option value="Virement">Virement</option>
                    <option value="Chèque">Chèque</option>
                    <option value="OM">OM</option>
                    <option value="Espèces">Espèces</option>
                    <option value="Cartes de recharges">Cartes de recharges</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs text-gray-600 dark:text-gray-300">Categorie de validation</div>
                  <select
                    value={validationStopRole}
                    onChange={(e) => setValidationStopRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                  >
                    <option value="DG">Parcours complet (DG)</option>
                    <option value="DGA">Jusqu'au DGA</option>
                    <option value="DAF">Jusqu'au DAF</option>
                  </select>
                </div>
              </div>

              {paiementImmediat === false ? (
                <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="text-xs text-gray-600 dark:text-gray-300">Conditions de paiement</div>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="daf-conditions-choice"
                        checked={dafConditionsChoice === "demandeur"}
                        disabled={!demandeurConditions.length}
                        onChange={() => setDafConditionsChoice("demandeur")}
                      />
                      Utiliser les conditions du demandeur
                    </label>
                    {!demandeurConditions.length ? (
                      <div className="text-xs text-amber-600">Aucune condition du demandeur disponible.</div>
                    ) : null}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="daf-conditions-choice"
                        checked={dafConditionsChoice === "daf"}
                        onChange={() => setDafConditionsChoice("daf")}
                      />
                      Modifier ou creer des conditions DAF
                    </label>
                  </div>

                  {dafConditionsChoice === "demandeur" ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Base: {formatMoney(totalMontant)} FCFA
                      </div>
                      <div
                        className={`text-xs ${
                          demandeurSumValid ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        Somme des pourcentages:{" "}
                        {demandeurSumInfo.hasAny ? `${demandeurSumInfo.sum.toFixed(2)}%` : "-"}{" "}
                        (doit faire 100%)
                      </div>
                      {demandeurConditions.map((c, idx) => {
                        const pctNum = Number(c?.pourcentage);
                        const amount =
                          Number.isFinite(Number(c?.montant_prevu))
                            ? Number(c.montant_prevu)
                            : Number.isFinite(pctNum) && totalMontant > 0
                              ? (totalMontant * pctNum) / 100
                              : null;
                        return (
                          <div
                            key={`${c?.id || "dem"}-${idx}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-200"
                          >
                            <div className="font-medium">{c?.label || `Tranche ${idx + 1}`}</div>
                            <div>{Number.isFinite(pctNum) ? `${pctNum}%` : "-"}</div>
                            <div>{formatAmount(amount)}</div>
                            <div className="text-gray-500 dark:text-gray-400">{c?.condition_texte || "-"}</div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <select
                        value={dafConditionsMode}
                        onChange={(e) => setDafConditionsMode(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                      >
                        <option value="100/100">100/100</option>
                        <option value="70/30">70/30</option>
                        <option value="50/50">50/50</option>
                        <option value="custom">Personnalise</option>
                      </select>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Base: {formatMoney(totalMontant)} FCFA
                        </div>
                        {demandeurConditions.length ? (
                          <button
                            type="button"
                            onClick={copyDemandeurConditions}
                            className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                          >
                            Copier conditions du demandeur
                          </button>
                        ) : null}
                      </div>

                      {dafConditionsMode !== "custom" && partsForMode.length ? (
                        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                          {partsForMode.map((p, idx) => (
                            <div key={`${p}-${idx}`} className="flex items-center justify-between gap-2">
                              <span>{`Tranche ${idx + 1} (${p}%)`}</span>
                              <span>{formatAmount((totalMontant * p) / 100)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {dafConditionsMode === "custom" ? (
                        <div className="mt-3 space-y-2">
                          <div
                            className={`text-xs ${
                              !customSumInfo.hasAny
                                ? "text-gray-500 dark:text-gray-400"
                                : customSumValid
                                  ? "text-emerald-600"
                                  : "text-red-600"
                            }`}
                          >
                            Somme des pourcentages:{" "}
                            {customSumInfo.hasAny ? `${customSumInfo.sum.toFixed(2)}%` : "-"} (doit faire 100%)
                          </div>
                          {dafConditions.map((c, idx) => (
                            <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
                              <input
                                value={c.label}
                                onChange={(e) => setDafCondition(idx, "label", e.target.value)}
                                className="sm:col-span-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                placeholder={`Tranche ${idx + 1}`}
                              />
                              <input
                                value={c.pourcentage}
                                onChange={(e) => setDafCondition(idx, "pourcentage", e.target.value)}
                                className="sm:col-span-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                placeholder="%"
                              />
                              <input
                                value={c.condition_texte}
                                onChange={(e) => setDafCondition(idx, "condition_texte", e.target.value)}
                                className="sm:col-span-3 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
                                placeholder="Condition (optionnel)"
                              />
                              <div className="sm:col-span-6 text-xs text-gray-500 dark:text-gray-400">
                                Montant prevu:{" "}
                                {formatAmount(
                                  Number.isFinite(toNumber(c.pourcentage)) && totalMontant > 0
                                    ? (totalMontant * Number(c.pourcentage)) / 100
                                    : null
                                )}
                              </div>
                              <div className="sm:col-span-6 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => removeDafCondition(idx)}
                                  disabled={dafConditions.length <= 1}
                                  className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60"
                                >
                                  Retirer
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={addDafCondition}
                              className="px-2 py-1 text-xs border border-gray-200 rounded-lg dark:border-gray-800"
                            >
                              Ajouter une tranche
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ces champs seront affichés sur la fiche (PDF) de la demande.
              </div>
            </div>
          ) : null}

          <div>
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Commentaire</div>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder={
                mode === "reject"
                  ? "Motif du rejet (obligatoire)"
                  : mode === "return"
                    ? "Motif du retour pour modification (obligatoire)"
                    : "Optionnel"
              }
            />
          </div>


          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              title="Annuler"
              aria-label="Annuler"
              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FiX />
            </button>

            <button
              type="submit"
              disabled={submitting}
              title={submitting ? "Traitement..." : mode === "approve" ? "Valider" : mode === "reject" ? "Rejeter" : "Retourner"}
              aria-label={submitting ? "Traitement..." : mode === "approve" ? "Valider" : mode === "reject" ? "Rejeter" : "Retourner"}
              className={`inline-flex items-center justify-center p-2 rounded-lg text-white hover:opacity-90 disabled:opacity-60 ${
                mode === "approve"
                  ? "bg-gray-900 dark:bg-white dark:text-gray-900"
                  : mode === "reject"
                    ? "bg-red-600"
                    : "bg-amber-600"
              }`}
            >
              {mode === "approve" ? <FiCheckCircle /> : mode === "reject" ? <FiXCircle /> : <FiCornerUpLeft />}
            </button>
          </div>
        </form>
    </Modal>
  );
}

function YesNo({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="text-xs text-gray-600 dark:text-gray-300">{label}</div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={label}
            checked={value === true}
            onChange={() => onChange(true)}
          />
          Oui
        </label>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="radio"
            name={label}
            checked={value === false}
            onChange={() => onChange(false)}
          />
          Non
        </label>
      </div>
    </div>
  );
}
