import React from "react";
import { createPortal } from "react-dom";
import Loader from "./Loader";

export default function FullscreenLoader({ show, label = "Chargement..." }) {
  if (!show) return null;

  const content = (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-white/70 dark:bg-black/50 backdrop-blur-sm">
      <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm dark:bg-gray-900 dark:border-gray-800">
        <Loader label={label} size="lg" />
      </div>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}
