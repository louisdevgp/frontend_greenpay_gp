import { api } from "./api";

// En attente
export async function listValidationsPending(params = {}) {
  const res = await api.get("/validations/pending", { params });
  return res.data; // { success, data: [...] }
}

// Historique
export async function listValidationsDone(params = {}) {
  const res = await api.get("/validations/history", { params });
  return res.data;
}

// Valider
export async function approveValidation(id, payload = {}) {
  const res = await api.post(`/validations/${id}/approve`, payload);
  return res.data;
}

// Rejeter
export async function rejectValidation(id, payload = {}) {
  const res = await api.post(`/validations/${id}/reject`, payload);
  return res.data;
}

// Retourner pour modification
export async function returnValidationForModification(id, payload = {}) {
  const res = await api.post(`/validations/${id}/return-for-modification`, payload);
  return res.data;
}

// Annuler une validation
export async function cancelValidation(id, payload = {}) {
  const res = await api.post(`/validations/${id}/cancel`, payload);
  return res.data;
}

export async function getValidationByUuid(uuid) {
  const res = await api.get(`/validations/uuid/${uuid}`); // adapte si ton endpoint diffère
  return res.data;
}

export async function listValidationsDoneByDemande(demandeUuid) {
  const res = await api.get(`/validations/done-by-demande/${demandeUuid}`);
  return res.data;
}
