import { formatMoney } from "./formatUtils";

export function numberValue(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
  return `${code}${libelle}`;
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
