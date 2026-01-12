// src/services/auth.service.js
import { api } from "./api";
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from "../utils/storage";

export async function login({ email, password }) {
  // Exemple endpoint (adapte si ton API est différent)
  // POST /auth/login
  const res = await api.post("/auth/login", { email, password });
  return res.data; // { success, message, data }
}

export async function me() {
  // GET /auth/me
  const res = await api.get("/users/me");
  return res.data; // { success, message, data }
}

export async function changePassword({ oldPassword, newPassword }) {
  const res = await api.patch("/auth/change-password", { oldPassword, newPassword });
  return res.data;
}

export async function forgotPassword({ email }) {
  const res = await api.post("/auth/forgot-password", { email });
  return res.data;
}

export async function resetPassword({ token, newPassword }) {
  const res = await api.post("/auth/reset-password", { token, newPassword });
  return res.data;
}

export function getAuth() {
  return readStorage(STORAGE_KEYS.AUTH, null);
}

// On stocke exactement: { accessToken, refreshToken, user, persist }
export function setAuth(payload) {
  writeStorage(STORAGE_KEYS.AUTH, payload);
}

export function clearAuth() {
  removeStorage(STORAGE_KEYS.AUTH);
}
