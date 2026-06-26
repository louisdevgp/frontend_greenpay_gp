import React from "react";
import { FiPaperclip } from "react-icons/fi";

function attachmentCount(demande) {
  if (Array.isArray(demande?.documents)) return demande.documents.length;

  const parsed = Number(
    demande?.documents_count ??
      demande?.document_count ??
      demande?._count?.documents ??
      0
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export default function DemandAttachmentsIndicator({ demande }) {
  const count = attachmentCount(demande);
  if (!count) return <span className="text-gray-300 dark:text-gray-700">-</span>;

  const label = `${count} piece${count > 1 ? "s" : ""} jointe${count > 1 ? "s" : ""}`;

  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400"
    >
      <FiPaperclip className="h-4 w-4" />
      <span className="text-xs font-semibold">{count}</span>
    </span>
  );
}
