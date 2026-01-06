import { api } from "./api";


export async function listPaiements() {
  const res = await api.get("/paiements");
  return res.data; // { success, data: [...] }
}

export async function getPaiement(uuid) {
  const res = await api.get(`/paiements/${uuid}`);
  return res.data; // { success, data: {...} }
}

export async function createPaiement(payload, files = []) {
  const form = new FormData();

  // champs
  Object.entries(payload || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    form.append(k, String(v));
  });

  // fichiers
  files.forEach((f) => form.append("documents", f));

  const res = await api.post("/paiements", form);
  return res.data;
}