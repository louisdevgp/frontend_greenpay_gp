// src/services/api.js
import axios from "axios";
import { readStorage, removeStorage, STORAGE_KEYS } from "../utils/storage";
import { emitToast } from "./toastBus";

const BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api"; // adapte si besoin

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
});

function isBlobResponse(response) {
  const rt = response?.config?.responseType;
  if (rt && rt !== "json") return true;
  // In some cases axios doesn't carry responseType but returns a Blob anyway
  if (typeof Blob !== "undefined" && response?.data instanceof Blob) return true;
  return false;
}

function normalizeResponsePayload(payload) {
  if (payload == null) return { success: true, message: "OK", data: null };

  // non-object payloads (string/number/array/etc.)
  if (typeof payload !== "object") {
    return { success: true, message: "OK", data: payload };
  }

  // arrays
  if (Array.isArray(payload)) {
    return { success: true, message: "OK", data: payload };
  }

  // already the canonical shape
  if (Object.prototype.hasOwnProperty.call(payload, "success") && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return {
      success: Boolean(payload.success),
      message: payload.message ?? "OK",
      data: payload.data,
    };
  }

  // backend sometimes returns { success: true, ...data } (no `data` wrapper)
  if (Object.prototype.hasOwnProperty.call(payload, "success")) {
    const { success, message, ...rest } = payload;
    return {
      success: Boolean(success),
      message: message ?? "OK",
      data: rest,
    };
  }

  // fallback: wrap unknown shapes
  return {
    success: true,
    message: payload.message ?? "OK",
    data: payload,
  };
}

let last401ToastAt = 0;

// Ajoute automatiquement le token à chaque requête
api.interceptors.request.use((config) => {
  const auth = readStorage(STORAGE_KEYS.AUTH, null);
  const token = auth?.accessToken;

  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isBlobResponse(response)) return response;
    response.data = normalizeResponsePayload(response.data);
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const serverMessage = error?.response?.data?.message;
    const message = serverMessage || error?.message || "Erreur réseau";

    if (status === 401) {
      removeStorage(STORAGE_KEYS.AUTH);
      const now = Date.now();
      if (now - last401ToastAt > 5000) {
        last401ToastAt = now;
        emitToast({
          variant: "warning",
          title: "Session expirée",
          message: "Veuillez vous reconnecter.",
        });
      }
    } else if (status === 403) {
      emitToast({
        variant: "error",
        title: "Accès refusé",
        message,
      });
    } else if (status >= 400) {
      emitToast({
        variant: "error",
        title: "Erreur API",
        message,
      });
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.data = error?.response?.data;
    return Promise.reject(wrapped);
  }
);
