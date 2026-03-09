import { api } from "./api";

export async function listPermissions() {
  const res = await api.get("/permissions");
  return res.data;
}

export async function getRolePermissions(roleId) {
  const res = await api.get(`/permissions/roles/${roleId}`);
  return res.data;
}

export async function setRolePermissions(roleId, permissionCodes = []) {
  const res = await api.put(`/permissions/roles/${roleId}`, { permissionCodes });
  return res.data;
}

export async function getUserPermissions(userId) {
  const res = await api.get(`/permissions/users/${userId}`);
  return res.data;
}

export async function setUserPermissions(userId, { allowCodes = [], denyCodes = [], scopes = {} } = {}) {
  const res = await api.put(`/permissions/users/${userId}`, { allowCodes, denyCodes, scopes });
  return res.data;
}
