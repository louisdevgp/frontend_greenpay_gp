import { api } from "./api";

function isNumericId(v) {
  return /^[0-9]+$/.test(String(v));
}

export async function listReceptions(params = {}) {
  const res = await api.get("/receptions", { params });
  return res.data;
}

export async function getReception(uuidOrId) {
  const path = isNumericId(uuidOrId) ? `/receptions/${uuidOrId}` : `/receptions/uuid/${uuidOrId}`;
  const res = await api.get(path);
  return res.data;
}

export async function createReception(payload) {
  const res = await api.post("/receptions", payload);
  return res.data;
}

export async function startReceptionSignature(payload) {
  const res = await api.post("/receptions/signature/start", payload);
  return res.data;
}

export async function completeReceptionSignature(sessionId) {
  const res = await api.post("/receptions/signature/complete", { session_id: sessionId });
  return res.data;
}

export async function visaDirecteur(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-directeur`, payload);
  return res.data;
}

export async function visaDaf(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-daf`, payload);
  return res.data;
}

export async function startVisaDirecteurSignature(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-directeur/signature/start`, payload);
  return res.data;
}

export async function completeVisaDirecteurSignature(receptionId, sessionId) {
  const res = await api.post(`/receptions/${receptionId}/visa-directeur/signature/complete`, { session_id: sessionId });
  return res.data;
}

export async function startVisaDafSignature(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-daf/signature/start`, payload);
  return res.data;
}

export async function completeVisaDafSignature(receptionId, sessionId) {
  const res = await api.post(`/receptions/${receptionId}/visa-daf/signature/complete`, { session_id: sessionId });
  return res.data;
}
