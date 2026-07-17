import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiExternalLink, FiFileText, FiRefreshCw, FiX } from "react-icons/fi";
import { Modal } from "../ui/modal";
import { api } from "../../services/api";

let pdfJsPromise = null;

function loadPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist/build/pdf.mjs"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjsLib, workerModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

async function extractBlobError(blob) {
  if (!blob || typeof blob.text !== "function") return null;
  try {
    const raw = await blob.text();
    if (!raw) return null;
    const payload = JSON.parse(raw);
    return payload?.message || null;
  } catch {
    return null;
  }
}

function PdfCanvasViewer({ data }) {
  const containerRef = useRef(null);
  const viewerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries?.[0]?.contentRect?.width || 0);
      if (!width) return;
      setContainerWidth((prev) => {
        if (!prev) return width;
        return Math.abs(prev - width) > 24 ? width : prev;
      });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !data || !containerWidth) return undefined;

    let cancelled = false;
    let loadingTask = null;
    viewer.innerHTML = "";
    setRendering(true);
    setError("");

    async function render() {
      const pdfjsLib = await loadPdfJs();
      if (cancelled) return;
      loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });
      const pdf = await loadingTask.promise;
      const maxPageWidth = Math.max(320, Math.min(containerWidth - 32, 920));
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (cancelled) return;

        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = maxPageWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });

        const pageWrap = document.createElement("div");
        pageWrap.className = "bg-white shadow-lg ring-1 ring-gray-200";
        pageWrap.style.width = `${Math.floor(viewport.width)}px`;

        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width * pixelRatio);
        canvas.height = Math.floor(viewport.height * pixelRatio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        pageWrap.appendChild(canvas);
        viewer.appendChild(pageWrap);

        const context = canvas.getContext("2d", { alpha: false });
        const renderTask = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : null,
        });
        await renderTask.promise;
        page.cleanup();
      }
    }

    render()
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Le PDF n'a pas pu etre affiche.");
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      if (viewer) viewer.innerHTML = "";
    };
  }, [data, containerWidth]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 h-full overflow-y-auto overflow-x-auto overscroll-contain bg-gray-200 dark:bg-gray-950"
    >
      {rendering ? (
        <div className="sticky top-0 z-10 flex items-center justify-center gap-2 bg-gray-900/80 px-3 py-2 text-xs text-white">
          <FiRefreshCw className="animate-spin" />
          Rendu du PDF...
        </div>
      ) : null}
      {error ? (
        <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      ) : null}
      <div ref={viewerRef} className="mx-auto flex w-full flex-col items-center gap-5 px-4 py-5" />
    </div>
  );
}

export default function PdfPreviewModal({ open, url, title = "Previsualisation PDF", onClose }) {
  const [objectUrl, setObjectUrl] = useState("");
  const [pdfData, setPdfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const externalUrl = useMemo(() => {
    if (!objectUrl) return "";
    return `${objectUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=page-fit`;
  }, [objectUrl]);

  useEffect(() => {
    if (!open || !url) {
      setObjectUrl("");
      setPdfData(null);
      setLoading(false);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    setObjectUrl("");
    setPdfData(null);

    api
      .get(url, { responseType: "blob" })
      .then(async (res) => {
        const contentType = res?.headers?.["content-type"] || "application/pdf";
        if (String(contentType).toLowerCase().includes("application/json")) {
          const message = await extractBlobError(res.data);
          throw new Error(message || "Le PDF n'a pas pu etre genere.");
        }

        const blob = new Blob([res.data], { type: contentType });
        const nextUrl = window.URL.createObjectURL(blob);
        const buffer = await blob.arrayBuffer();

        if (cancelled) {
          window.URL.revokeObjectURL(nextUrl);
          return;
        }
        setObjectUrl(nextUrl);
        setPdfData(new Uint8Array(buffer));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Le PDF n'a pas pu etre charge.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, url]);

  useEffect(() => {
    return () => {
      if (objectUrl) window.URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      showCloseButton={false}
      className="m-3 flex h-[94vh] max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <FiFileText className="shrink-0" />
            <span className="truncate">{title}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Apercu dans l'application, sans telechargement automatique.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {externalUrl ? (
            <button
              type="button"
              onClick={() => window.open(externalUrl, "_blank", "noopener,noreferrer")}
              title="Ouvrir en plein ecran"
              aria-label="Ouvrir en plein ecran"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <FiExternalLink />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            title="Fermer"
            aria-label="Fermer"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 p-2 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FiX />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 bg-gray-200 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300">
            <FiRefreshCw className="animate-spin" />
            Chargement du PDF...
          </div>
        ) : error ? (
          <div className="h-full bg-gray-200 p-4 dark:bg-gray-950">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
              {error}
            </div>
          </div>
        ) : pdfData ? (
          <PdfCanvasViewer data={pdfData} />
        ) : (
          <div className="flex h-full items-center justify-center bg-gray-200 text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
            Aucun PDF a afficher.
          </div>
        )}
      </div>
    </Modal>
  );
}
