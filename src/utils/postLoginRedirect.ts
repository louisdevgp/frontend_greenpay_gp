const STORAGE_KEY = "auth:redirect";

function isSafeRedirect(path?: string | null) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

function normalizeRedirect(path?: string | null) {
  return isSafeRedirect(path) ? String(path) : null;
}

export function buildRedirectFromLocation(location: { pathname?: string; search?: string; hash?: string }) {
  const pathname = location?.pathname || "/";
  const search = location?.search || "";
  const hash = location?.hash || "";
  return `${pathname}${search}${hash}`;
}

export function getRedirectFromSearch(search?: string | null) {
  if (!search) return null;
  const params = new URLSearchParams(search);
  const raw = params.get("redirect");
  return normalizeRedirect(raw);
}

export function setPostLoginRedirect(path?: string | null) {
  const value = normalizeRedirect(path);
  if (!value) return;
  try {
    sessionStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

export function getPostLoginRedirect() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return normalizeRedirect(stored);
  } catch {
    return null;
  }
}

export function consumePostLoginRedirect(fallback = "/") {
  const stored = getPostLoginRedirect();
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return stored || fallback;
}

export function buildSigninRedirectUrl(path: string) {
  const safe = normalizeRedirect(path) || "/";
  const encoded = encodeURIComponent(safe);
  return `/signin?redirect=${encoded}`;
}

export function buildChangePasswordRedirectUrl(path: string) {
  const safe = normalizeRedirect(path) || "/";
  const encoded = encodeURIComponent(safe);
  return `/change-password?redirect=${encoded}`;
}
