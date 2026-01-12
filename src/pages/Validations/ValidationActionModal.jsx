import React, { useMemo, useState } from "react";
import { approveValidation, rejectValidation } from "../../services/validations.service";
import { Modal } from "../../components/ui/modal";

export default function ValidationActionModal({ open, mode, item, onClose, onDone }) {
  // mode: "approve" | "reject"
  const [commentaire, setCommentaire] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const title = useMemo(() => (mode === "approve" ? "Valider la demande" : "Rejeter la demande"), [mode]);

  const close = () => {
    if (submitting) return;
    setCommentaire("");
    setError("");
    onClose?.();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      setSubmitting(true);
      const id = item?.id;
      if (!id) throw new Error("Validation ID manquant");

      const commentaireTrimmed = (commentaire || "").trim();
      if (mode === "reject" && !commentaireTrimmed) {
        throw new Error("Commentaire obligatoire");
      }

      const res =
        mode === "approve"
          ? await approveValidation(id)
          : await rejectValidation(id, { commentaire: commentaireTrimmed });

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
              {mode === "approve" ? "Ajouter un commentaire si besoin." : "Commentaire obligatoire pour le rejet."}
            </p>
          </div>

          <button
            type="button"
            disabled={submitting}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={close}
          >
            Fermer
          </button>
        </div>

        {error ? (
          <div className="px-4 py-3 mt-4 text-sm rounded-lg bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div>
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Commentaire</div>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none dark:bg-gray-950 dark:border-gray-800"
              placeholder={mode === "reject" ? "Motif du rejet (obligatoire)" : "Optionnel"}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
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
              className={`px-4 py-2 text-sm rounded-lg text-white hover:opacity-90 disabled:opacity-60 ${
                mode === "approve"
                  ? "bg-gray-900 dark:bg-white dark:text-gray-900"
                  : "bg-red-600"
              }`}
            >
              {submitting ? "Traitement..." : mode === "approve" ? "Valider" : "Rejeter"}
            </button>
          </div>
        </form>
    </Modal>
  );
}
