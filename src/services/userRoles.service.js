import { api } from "./api";

export async function setUserRoles(userIdOrUuid, roles = []) {
  const res = await api.put(`/user-roles/users/${userIdOrUuid}/roles`, { roles });
  return res.data;
}
