import { api } from "./api";

export async function listArchivesV1Demandes(params = {}) {
  const res = await api.get("/archives-v1/demandes", { params });
  return res.data;
}

export async function getArchivesV1Demande(id) {
  const res = await api.get(`/archives-v1/demandes/${id}`);
  return res.data;
}

export async function getArchivesV1Stats() {
  const res = await api.get("/archives-v1/stats");
  return res.data;
}
