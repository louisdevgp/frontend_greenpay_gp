import React from "react";
import { FiCheckCircle, FiX } from "react-icons/fi";

export default function FirmaSignatureFrame({
  signingUrl,
  signatureRequestId,
  signatureUserId,
  onCancel,
  onComplete,
  onError,
  busy = false,
  title = "Signer pour continuer.",
}) {
  React.useEffect(() => {
    if (!signingUrl) return undefined;

    const handler = (event) => {
      if (event.origin !== "https://app.firma.dev") return;
      const type = event?.data?.type;
      if (!type) return;
      if (type === "signing.completed") {
        onComplete?.();
        return;
      }
      if (type === "signing.declined") {
        onError?.("Signature refusee.");
      }
      if (type === "signing.failed") {
        onError?.("Signature echouee.");
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [signingUrl, onComplete, onError]);

  if (!signingUrl) return null;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
        <div>{title}</div>
        {signatureRequestId || signatureUserId ? (
          <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
            Ref: {signatureRequestId || signatureUserId}
          </div>
        ) : null}
      </div>

      <div className="h-[520px] overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <iframe
          title="Signature Firma"
          src={signingUrl}
          className="h-full w-full"
          allow="clipboard-read; clipboard-write"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span>Si la signature ne s'affiche pas, ouvrez dans un nouvel onglet.</span>
        {signingUrl ? (
          <a
            href={signingUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-200"
          >
            Ouvrir
          </a>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          title="Annuler"
          aria-label="Annuler"
          className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 dark:border-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <FiX />
        </button>

        <button
          type="button"
          onClick={onComplete}
          disabled={busy}
          title="J'ai signe"
          aria-label="J'ai signe"
          className="inline-flex items-center justify-center p-2 rounded-lg text-white hover:opacity-90 disabled:opacity-60 bg-gray-900 dark:bg-white dark:text-gray-900"
        >
          <FiCheckCircle />
        </button>
      </div>
    </div>
  );
}
