function toKey(v) {
  return String(v || "").trim().toLowerCase();
}

function titleizeFromKey(key) {
  if (!key) return "-";
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function labelDemandeStatut(statut) {
  const k = toKey(statut);
  if (!k) return "-";

  const map = {
    draft: "Brouillon",
    brouillon: "Brouillon",
    soumise: "Soumise",
    a_modifier: "À modifier",

    validation_responsable: "Validation Responsable",
    validation_section: "Validation Section",
    validation_entite: "Validation Entité",
    validation_entite_generale: "Validation Entité Générale",
    validation_directeur: "Validation Directeur",
    validation_daf: "Validation DAF",
    validation_dga: "Validation DGA",
    validation_dg: "Validation DG",

    en_attente_paiement: "En attente de paiement",
    approuvee: "Approuvée",
    paye: "Payée",
    receptionnee: "Réceptionnée",
    cloture: "Clôturée",
    rejete: "Rejetée",
    rejetee: "Rejetée",
  };

  return map[k] || titleizeFromKey(k);
}

export function labelValidationStepStatus(status) {
  const k = toKey(status);
  if (!k) return "-";

  const map = {
    valide: "Validé",
    en_attente: "En attente",
    bloque: "Bloqué",
    retour_modification: "Retournée (modification)",
    rejete: "Rejeté",
    rejetee: "Rejeté",
    "rejeté": "Rejeté",
    annule: "Annulée",
    annulee: "Annulée",
    annulation: "Annulée",
  };

  return map[k] || titleizeFromKey(k);
}

export function demandeStatusBadgeClass(statut) {
  const k = toKey(statut);
  if (!k) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";

  const classes = {
    gray: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    sky: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200",
    cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200",
    amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
    indigo: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200",
    violet: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200",
    emerald: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
    teal: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200",
    fuchsia: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-200",
    rose: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200",
    orange: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200",
    slate: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200",
  };

  if (k === "draft" || k === "brouillon") return classes.gray;
  if (k === "soumise") return classes.sky;
  if (k === "a_modifier") return classes.amber;
  if (k === "validation_responsable") return classes.blue;
  if (k === "validation_section") return classes.cyan;
  if (k === "validation_entite") return classes.indigo;
  if (k === "validation_entite_generale") return classes.violet;
  if (k === "validation_directeur") return classes.orange;
  if (k === "validation_daf") return classes.yellow;
  if (k === "validation_dga") return classes.rose;
  if (k === "validation_dg") return classes.teal;
  if (k === "en_cours_validation" || k.startsWith("validation_")) return classes.indigo;
  if (k === "approuvee") return classes.green;
  if (k === "en_attente_paiement") return classes.fuchsia;
  if (k === "paye" || k === "payee") return classes.emerald;
  if (k === "receptionnee") return classes.cyan;
  if (k === "cloture" || k === "cloturee") return classes.slate;
  if (k === "rejete" || k === "rejetee" || k === "rejeté") return classes.red;

  return classes.gray;
}
