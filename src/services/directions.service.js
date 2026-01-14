import { api } from "./api";

export async function listDirections() {
  const res = await api.get("/directions");
  return res.data;
}

export async function createDirection(payload) {
  const res = await api.post("/directions", payload);
  return res.data;
}

export async function updateDirection(idOrUuid, payload) {
  const res = await api.put(`/directions/${idOrUuid}`, payload);
  return res.data;
}

export async function deleteDirection(idOrUuid) {
  const res = await api.delete(`/directions/${idOrUuid}`);
  return res.data;
}
