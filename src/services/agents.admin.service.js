import { api } from "./api";

export async function listAgents(params = {}) {
  const res = await api.get("/agents", { params });
  return res.data;
}

export async function createAgent(payload) {
  const res = await api.post("/agents", payload);
  return res.data;
}

export async function updateAgent(id, payload) {
  const res = await api.put(`/agents/${id}`, payload);
  return res.data;
}

export async function softDeleteAgent(id) {
  const res = await api.delete(`/agents/${id}`);
  return res.data;
}

export async function setAgentManager(id, payload) {
  const res = await api.post(`/agents/${id}/manager`, payload);
  return res.data;
}
