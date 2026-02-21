import React from "react";
import { Modal } from "../ui/modal";

export default function ConfirmActionModal({
  open,
  title = "Confirmation",
  message = "",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  confirmVariant = "danger",
  showComment = false,
  commentLabel = "Commentaire",
  commentPlaceholder = "Ajoutez un commentaire",
  commentValue = "",
  onCommentChange,
  commentRequired = false,
  commentDisabled = false,
  commentHelp = "",
  confirmDisabled = false,
  onConfirm,
  onClose,
  loading = false,
}) {
  if (!open) return null;

  const confirmClassMap = {
    danger: "bg-red-600 text-white hover:opacity-90",
    warn: "bg-amber-600 text-white hover:opacity-90",
    primary: "bg-gray-900 text-white hover:opacity-90 dark:bg-white dark:text-gray-900",
  };

  const confirmClass = confirmClassMap[confirmVariant] || confirmClassMap.danger;
  const handleCommentChange = onCommentChange || (() => {});
  const isConfirmDisabled = loading || confirmDisabled;

  return (
    <Modal
      isOpen={open}
      onClose={loading ? () => {} : onClose}
      showCloseButton={false}
      className="w-full max-w-md rounded-2xl border border-gray-200 p-5 shadow-xl dark:border-gray-800"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h2>
          {message ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{message}</p>
          ) : null}
        </div>
      </div>

      {showComment ? (
        <div className="mt-4">
          <label className="block text-xs text-gray-500 dark:text-gray-400">
            {commentLabel}
            {commentRequired ? " *" : ""}
          </label>
          <textarea
            rows={3}
            value={commentValue}
            onChange={handleCommentChange}
            placeholder={commentPlaceholder}
            disabled={commentDisabled || loading}
            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-800 dark:bg-gray-950"
          />
          {commentHelp ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{commentHelp}</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm border border-gray-200 rounded-lg dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirmDisabled}
          className={`px-4 py-2 text-sm rounded-lg disabled:opacity-60 disabled:cursor-not-allowed ${confirmClass}`}
        >
          {loading ? "Traitement..." : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
