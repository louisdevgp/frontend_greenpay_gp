import { api } from "./api";

export async function listUsers(params = {}) {
  const res = await api.get("/users", { params });
  return res.data;
}

export async function createUser(payload) {
  const res = await api.post("/users", payload);
  return res.data;
}

export async function getUser(idOrUuid) {
  const res = await api.get(`/users/${idOrUuid}`);
  return res.data;
}

export async function updateUser(idOrUuid, payload) {
  const res = await api.patch(`/users/${idOrUuid}`, payload);
  return res.data;
}

export async function softDeleteUser(idOrUuid) {
  const res = await api.delete(`/users/${idOrUuid}`);
  return res.data;
}

export async function adminResetUserPassword(idOrUuid) {
  const res = await api.post(`/users/${idOrUuid}/reset-password`);
  return res.data;
}
