import { api } from "./api";


export async function listPaiements(params = {}) {
  const res = await api.get("/paiements", { params });
  return res.data; // { success, data: [...] }
}

function isNumericId(v) {
  return /^[0-9]+$/.test(String(v));
}

export async function getPaiement(idOrUuid) {
  const path = isNumericId(idOrUuid) ? `/paiements/${idOrUuid}` : `/paiements/uuid/${idOrUuid}`;
  const res = await api.get(path);
  return res.data; // { success, data: {...} }
}


export async function createPaiement(payload) {
  const res = await api.post("/paiements/pay", payload);
  return res.data; // { success, data: paiement }
}

export async function startPaiementSignature(payload) {
  const res = await api.post("/paiements/signature/start", payload);
  return res.data;
}

export async function completePaiementSignature(sessionId) {
  const res = await api.post("/paiements/signature/complete", { session_id: sessionId });
  return res.data;
}
