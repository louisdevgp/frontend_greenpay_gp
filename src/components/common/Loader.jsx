import React from "react";

export default function Loader({
  label = "Chargement...",
  size = "md", // sm | md | lg
  inline = false, // true => petit loader inline (bouton)
}) {
  const px = size === "sm" ? 16 : size === "lg" ? 28 : 22;

  if (inline) {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className="animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white"
          style={{ width: px, height: px }}
        />
        {label ? <span className="text-sm">{label}</span> : null}
      </span>
    );
  }

  return (
    <div className="flex items-center justify-center w-full py-10">
      <div className="flex items-center gap-3">
        <span
          className="animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-white"
          style={{ width: px, height: px }}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      </div>
    </div>
  );
}
