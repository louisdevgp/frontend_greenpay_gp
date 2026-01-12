import { api } from "./api";

function isNumericId(v) {
  return /^[0-9]+$/.test(String(v));
}

export async function createBonCommande(payload) {
  const res = await api.post("/bons-commande", payload);
  return res.data;
}

export async function listBonCommandes(params = {}) {
  const res = await api.get("/bons-commande", { params });
  return res.data;
}

export async function getBonCommande(idOrUuid) {
  const path = isNumericId(idOrUuid) ? `/bons-commande/${idOrUuid}` : `/bons-commande/by-uuid/${idOrUuid}`;
  const res = await api.get(path);
  return res.data;
}
