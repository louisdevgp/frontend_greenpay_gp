import { api } from "../services/api";

/**
 * Fetch a file as Blob and either download it or preview it.
 *
 * Backward compatible:
 * - downloadFile(url, filename)
 * - downloadFile(url, filename, { mode: 'download' | 'preview' })
 */
export async function downloadFile(url, filename, options = {}) {
  const mode = options?.mode || "download";

  const res = await api.get(url, { responseType: "blob" });

  const contentType = res?.headers?.["content-type"] || "application/octet-stream";
  if (String(contentType).toLowerCase().includes("application/json")) {
    const payload = JSON.parse(await res.data.text());
    throw new Error(payload?.message || "Le fichier n'a pas pu etre genere.");
  }

  const blob = new Blob([res.data], { type: contentType });

  const objectUrl = window.URL.createObjectURL(blob);

  if (mode === "preview") {
    const win = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      // popup bloqué → fallback download
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    // laisser le temps au nouvel onglet de charger le blob
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
    return;
  }

  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60_000);
}
