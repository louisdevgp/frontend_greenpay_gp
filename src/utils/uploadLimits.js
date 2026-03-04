export const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  let size = Math.max(0, bytes);
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  const decimals = size >= 100 ? 0 : size >= 10 ? 1 : 2;
  return `${size.toFixed(decimals)} ${units[idx]}`;
}

export function splitFilesBySize(files = [], maxBytes = MAX_UPLOAD_SIZE_BYTES) {
  const accepted = [];
  const rejected = [];
  for (const file of files || []) {
    if (!file) continue;
    if (Number(file.size) > maxBytes) rejected.push(file);
    else accepted.push(file);
  }
  return { accepted, rejected };
}

export function buildFileTooLargeMessage(files = [], maxBytes = MAX_UPLOAD_SIZE_BYTES) {
  const limitLabel = formatFileSize(maxBytes);
  if (!files.length) return `Taille max: ${limitLabel}.`;
  const preview = files
    .slice(0, 3)
    .map((f) => `${f.name} (${formatFileSize(f.size)})`)
    .join(", ");
  const extra = files.length > 3 ? ` +${files.length - 3}` : "";
  return `Taille max: ${limitLabel}. Fichiers rejetes: ${preview}${extra}.`;
}

export function extractOversizedDropzoneFiles(fileRejections = []) {
  return (fileRejections || [])
    .filter((rej) => (rej?.errors || []).some((e) => e?.code === "file-too-large"))
    .map((rej) => rej?.file)
    .filter(Boolean);
}
