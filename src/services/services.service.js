import { api } from "./api";

export async function listServices(params = {}) {
  const res = await api.get("/services", { params });
  return res.data;
}

export async function createService(payload) {
  const res = await api.post("/services", payload);
  return res.data;
}

export async function updateService(idOrUuid, payload) {
  const res = await api.put(`/services/${idOrUuid}`, payload);
  return res.data;
}

export async function deleteService(idOrUuid) {
  const res = await api.delete(`/services/${idOrUuid}`);
  return res.data;
}
