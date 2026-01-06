// src/utils/storage.js
export const STORAGE_KEYS = {
  AUTH: "auth", // { token, user, roles }
};

export function readStorage(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function writeStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


export function removeStorage(key) {
  localStorage.removeItem(key);
}
