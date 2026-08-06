import { api } from "./api";

export async function listBudgetLines(params = {}) {
  const res = await api.get("/budget-lines", { params });
  return res.data;
}

export async function getBudgetLine(idOrUuid) {
  const res = await api.get(`/budget-lines/${idOrUuid}`);
  return res.data;
}

export async function createBudgetLine(payload) {
  const res = await api.post("/budget-lines", payload);
  return res.data;
}

export async function updateBudgetLine(idOrUuid, payload) {
  const res = await api.put(`/budget-lines/${idOrUuid}`, payload);
  return res.data;
}

export async function renewBudgetLine(idOrUuid, payload = {}) {
  const res = await api.post(`/budget-lines/${idOrUuid}/renew`, payload);
  return res.data;
}

export async function renewBudgetLines(payload = {}) {
  const res = await api.post("/budget-lines/renew", payload);
  return res.data;
}

export async function deleteBudgetLine(idOrUuid) {
  const res = await api.delete(`/budget-lines/${idOrUuid}`);
  return res.data;
}

export async function previewBudgetLine(params = {}) {
  const res = await api.get("/budget-lines/preview", { params });
  return res.data;
}
