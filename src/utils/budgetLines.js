import { formatMoney } from "./formatUtils";

export const BUDGET_MONTHS = [
  { value: 1, label: "Janvier" },
  { value: 2, label: "Fevrier" },
  { value: 3, label: "Mars" },
  { value: 4, label: "Avril" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Juin" },
  { value: 7, label: "Juillet" },
  { value: 8, label: "Aout" },
  { value: 9, label: "Septembre" },
  { value: 10, label: "Octobre" },
  { value: 11, label: "Novembre" },
  { value: 12, label: "Decembre" },
];

export function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function budgetMonthLabel(value) {
  const n = Number(value);
  return BUDGET_MONTHS.find((m) => Number(m.value) === n)?.label || "-";
}

export function budgetPeriodLabel(line) {
  if (!line) return "-";
  const exercice = line.exercice || "-";
  const mois = budgetMonthLabel(line.mois || 1);
  return `${mois} ${exercice}`;
}

export function budgetLineSolde(line) {
  if (!line) return 0;
  if (line.solde_disponible != null) return numberValue(line.solde_disponible);
  return numberValue(line.montant_initial) - numberValue(line.montant_engage) - numberValue(line.montant_paye);
}

export function budgetLineLabel(line) {
  if (!line) return "-";
  const code = line.code || `Ligne #${line.id}`;
  const libelle = line.libelle ? ` - ${line.libelle}` : "";
  const period = line.exercice ? ` (${budgetPeriodLabel(line)})` : "";
  return `${code}${libelle}${period}`;
}

export function budgetLineOptionLabel(line) {
  if (!line) return "-";
  return `${budgetLineLabel(line)} | Solde ${formatMoney(budgetLineSolde(line))} ${line.devise || "FCFA"}`;
}

export function budgetWarningForAmount(line, amount) {
  if (!line) return null;
  const montant = numberValue(amount);
  const solde = budgetLineSolde(line);
  const depassement = Math.max(0, montant - solde);
  return {
    solde,
    depassement,
    exceeded: depassement > 0,
    strict: String(line.controle_mode || "SOUPLE").toUpperCase() === "STRICT",
  };
}

export function formatBudgetWarning(line, amount) {
  const warning = budgetWarningForAmount(line, amount);
  if (!warning) return "";
  if (!warning.exceeded) {
    return `Solde disponible: ${formatMoney(warning.solde)} ${line.devise || "FCFA"}.`;
  }
  return `Depassement budgetaire de ${formatMoney(warning.depassement)} ${line.devise || "FCFA"} sur cette ligne.`;
}
