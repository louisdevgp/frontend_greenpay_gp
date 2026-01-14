import { api } from "./api";

export async function listDepartements(params = {}) {
  const res = await api.get("/departements", { params });
  return res.data;
}

export async function createDepartement(payload) {
  const res = await api.post("/departements", payload);
  return res.data;
}

export async function updateDepartement(idOrUuid, payload) {
  const res = await api.put(`/departements/${idOrUuid}`, payload);
  return res.data;
}

export async function deleteDepartement(idOrUuid) {
  const res = await api.delete(`/departements/${idOrUuid}`);
  return res.data;
}
