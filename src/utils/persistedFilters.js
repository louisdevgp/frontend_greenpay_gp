export function loadPersistedState(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function savePersistedState(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearPersistedState(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}
