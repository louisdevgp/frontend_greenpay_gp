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

export async function visaDirecteur(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-directeur`, payload);
  return res.data;
}

export async function visaDaf(receptionId, payload = {}) {
  const res = await api.post(`/receptions/${receptionId}/visa-daf`, payload);
  return res.data;
}