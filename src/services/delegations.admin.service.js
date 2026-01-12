import { api } from "./api";

export async function listDelegationAgents(params = {}) {
  const res = await api.get("/delegations/agents", { params });
  return res.data;
}

export async function listDelegations(params = {}) {
  const res = await api.get("/delegations", { params });
  return res.data;
}

export async function createDelegation(payload) {
  const res = await api.post("/delegations", payload);
  return res.data;
}

export async function updateDelegation(idOrUuid, payload) {
  const res = await api.put(`/delegations/${idOrUuid}`, payload);
  return res.data;
}

export async function toggleDelegation(idOrUuid) {
  const res = await api.patch(`/delegations/${idOrUuid}/toggle`);
  return res.data;
}

export async function deleteDelegation(idOrUuid) {
  const res = await api.delete(`/delegations/${idOrUuid}`);
  return res.data;
}
