/**
 * Format un nombre avec des séparateurs de milliers selon les conventions françaises
 * @param {number|string} value - La valeur à formater
 * @returns {string} - La valeur formatée avec des séparateurs de milliers
 */
export function formatMoney(value) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return String(value ?? "");
  const formatted = new Intl.NumberFormat("fr-FR").format(n);
  return formatted.replace(/[\u202F\u00A0]/g, " ");
}

/**
 * Format une date selon le format français JJ/MM/AAAA
 * @param {string|Date} date - La date à formater
 * @returns {string} - La date formatée
 */
export function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric"
  }).format(d);
}

/**
 * Format une date et heure selon le format français JJ/MM/AAAA HH:MM
 * @param {string|Date} date - La date à formater
 * @returns {string} - La date formatée
 */
export function formatDateTime(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(d);
}
