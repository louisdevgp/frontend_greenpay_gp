import { api } from "./api";

export async function getDashboardStats(params = {}) {
  const res = await api.get("/stats/dashboard", { params });
  return res.data; // { success, data }
}
