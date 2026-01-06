// src/services/api.js
import axios from "axios";
import { readStorage, STORAGE_KEYS } from "../utils/storage";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api"; // adapte si besoin

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
});

// Ajoute automatiquement le token à chaque requête
api.interceptors.request.use((config) => {
  console.log("STORAGE_KEYS:", STORAGE_KEYS);
  const auth = readStorage(STORAGE_KEYS.AUTH, null);
  const token = auth?.accessToken;

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
