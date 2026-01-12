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
    rejete: "Rejeté",
    rejetee: "Rejeté",
    "rejeté": "Rejeté",
  };

  return map[k] || titleizeFromKey(k);
}

export function labelBonCommandeStatut(statut) {
  const k = toKey(statut);
  if (!k) return "-";

  const map = {
    brouillon: "Brouillon",
    valide: "Validé",
    annule: "Annulé",
    annulee: "Annulé",
    cloture: "Clôturé",
  };

  return map[k] || titleizeFromKey(k);
}
