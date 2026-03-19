export const FIRMA_ENABLED = (() => {
  const v = String(import.meta.env.VITE_FIRMA_ENABLED || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
})();
