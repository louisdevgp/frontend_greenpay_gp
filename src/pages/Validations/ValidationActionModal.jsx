import React, { useMemo, useState } from "react";
import { FiCheckCircle, FiCornerUpLeft, FiX, FiXCircle } from "react-icons/fi";
import { approveValidation, rejectValidation, returnValidationForModification } from "../../services/validations.service";
import { Modal } from "../../components/ui/modal";

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

export default function ValidationActionModal({ open, mode, item, onClose, onDone }) {
  // mode: "approve" | "reject" | "return"
  const [commentaire, setCommentaire] = useState("");
  // On n'utilise plus les signatures
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const role = useMemo(() => String(item?.role_name || "").toUpperCase(), [item?.role_name]);
  const demande = item?.demandes_paiement || null;
  const isDaf = role === "DAF";

  const [budgetPrevu, setBudgetPrevu] = useState(null); // null | boolean
  const [budgetDisponible, setBudgetDisponible] = useState(null); // null | boolean
  const [paiementImmediat, setPaiementImmediat] = useState(null); // null | boolean
  const [dafCritere4, setDafCritere4] = useState(""); // string (moyen de paiement)

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
  }, [open, isDaf, demande?.budget_prevu, demande?.budget_disponible, demande?.paiement_immediat, demande?.daf_critere4]);

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

      if (mode === "approve" && isDaf) {
        if (budgetPrevu === null || budgetDisponible === null || paiementImmediat === null || !dafCritere4) {
          throw new Error("Contrôle DAF: renseigne Budget prévu, Budget disponible, Paiement immédiat et Moyen de paiement");
        }
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
                    daf_critere4: dafCritere4 ? String(dafCritere4).trim() : null, // Envoyer le moyen de paiement comme chaîne
                  }
                : {}),
            })
          : mode === "reject"
            ? await rejectValidation(id, { commentaire: commentaireTrimmed })
            : await returnValidationForModification(id, { commentaire: commentaireTrimmed });

      if (!res?.success) throw new Error(res?.message || "Action échouée");
      onDone?.();
      close();
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
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
                  </select>
                </div>
              </div>
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
