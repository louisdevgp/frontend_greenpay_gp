import { api } from "./api";

export async function listRoles() {
  const res = await api.get("/roles");
  return res.data;
}
