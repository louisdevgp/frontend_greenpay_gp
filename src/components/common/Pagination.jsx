import React from "react";
import Loader from "./Loader"; // Assurez-vous que le chemin est correct

export default function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  isLoading = false, // Nouveau prop pour gérer l'état de chargement
  pageSizeOptions = [5, 10, 20, 50],
}) {
  const totalPages = Math.max(1, Math.ceil((total || 0) / pageSize));

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Total: <span className="font-medium">{total || 0}</span> — Page{" "}
        <span className="font-medium">{page}</span> /{" "}
        <span className="font-medium">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
          disabled={isLoading} // Désactiver le select pendant le chargement
          className="px-2 py-2 text-xs border border-gray-200 rounded-lg dark:border-gray-800 dark:bg-gray-950 disabled:opacity-50"
        >
          {pageSizeOptions.map((s) => (
            <option key={s} value={s}>
              {s} / page
            </option>
          ))}
        </select>

        {isLoading ? (
          <Loader inline size="sm" label="Chargement..." />
        ) : (
          <>
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => onPageChange?.(1)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:opacity-50 dark:border-gray-800"
            >
              «
            </button>
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => onPageChange?.(page - 1)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:opacity-50 dark:border-gray-800"
            >
              Préc.
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => onPageChange?.(page + 1)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:opacity-50 dark:border-gray-800"
            >
              Suiv.
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => onPageChange?.(totalPages)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-lg disabled:opacity-50 dark:border-gray-800"
            >
              »
            </button>
          </>
        )}
      </div>
    </div>
  );
}
