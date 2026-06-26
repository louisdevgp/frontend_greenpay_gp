// src/services/api.js
import axios from "axios";
import { readStorage, removeStorage, STORAGE_KEYS } from "../utils/storage";
import { emitToast } from "./toastBus";

const inferredHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const inferredApiPort = import.meta.env.VITE_API_PORT || "8000";
const defaultApiUrl = `http://${inferredHost}:${inferredApiPort}/api`;

function normalizeBaseUrl(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) return defaultApiUrl;

  // Relative path ("/api" or "api")
  if (raw.startsWith("/")) return raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) {
    return `/${raw.replace(/^\/+/, "")}`.replace(/\/+$/, "");
  }

  try {
    const url = new URL(raw);
    const path = String(url.pathname || "").replace(/\/+$/, "");
    if (!path || path === "/") {
      url.pathname = "/api";
    } else if (!path.endsWith("/api")) {
      url.pathname = `${path}/api`;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

const BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL || defaultApiUrl);

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
});

let cachedToken = null;

export function setApiToken(token) {
  cachedToken = token || null;
  if (cachedToken) {
    api.defaults.headers.common.Authorization = `Bearer ${cachedToken}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}


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
let last403ToastAt = 0;

// Ajoute automatiquement le token à chaque requête
api.interceptors.request.use((config) => {
  const auth = readStorage(STORAGE_KEYS.AUTH, null);
  const token = cachedToken || auth?.accessToken || auth?.token || auth?.access_token;

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
  async (error) => {
    const status = error?.response?.status;
    let responseData = error?.response?.data;
    if (typeof Blob !== "undefined" && responseData instanceof Blob) {
      try {
        const raw = await responseData.text();
        responseData = raw ? JSON.parse(raw) : null;
      } catch {
        responseData = null;
      }
    }
    const serverMessage = responseData?.message;
    const message = serverMessage || error?.message || "Erreur réseau";

    if (status === 401) {
      removeStorage(STORAGE_KEYS.AUTH);
      const now = Date.now();
      if (now - last401ToastAt > 5000) {
        last401ToastAt = now;
        emitToast({
          variant: "warning",
          title: "Identifiants incorrects",
          message: "Veuillez vous reconnecter.",
          timeoutMs: 4500,
        });
      }
    } else if (status === 403) {
      const now = Date.now();
      if (now - last403ToastAt > 5000) {
        last403ToastAt = now;
        emitToast({
          variant: "error",
          title: "Accès refusé",
          message,
          timeoutMs: 4500,
        });
      }
    } else if (status >= 400) {
      emitToast({
        variant: "error",
        title: "Erreur API",
        message,
      });
    }

    const wrapped = new Error(message);
    wrapped.status = status;
    wrapped.data = responseData;
    return Promise.reject(wrapped);
  }
);
