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

export function getAuth() {
  console.log("Reading auth from storage with key:", STORAGE_KEYS.AUTH);
  return readStorage(STORAGE_KEYS.AUTH, null);
}

// On stocke exactement: { accessToken, refreshToken, user, persist }
export function setAuth(payload) {
  writeStorage(STORAGE_KEYS.AUTH, payload);
}

export function clearAuth() {
  removeStorage(STORAGE_KEYS.AUTH);
}
