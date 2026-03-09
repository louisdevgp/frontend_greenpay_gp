const DEFAULT_SCOPE = { type: "GLOBAL", id: null };
const VALID_SCOPE_TYPES = new Set(["GLOBAL", "DIRECTION", "DEPARTEMENT", "SERVICE"]);

export function normalizePermissionCode(code) {
  return String(code || "").trim().toUpperCase();
}

export function normalizeScopeType(value) {
  if (!value) return null;
  const v = String(value).trim().toUpperCase();
  return VALID_SCOPE_TYPES.has(v) ? v : null;
}

export function normalizeScopeId(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function scopeKey(scope) {
  const type = normalizeScopeType(scope?.type || scope?.scope_type) || "GLOBAL";
  const id = normalizeScopeId(scope?.id ?? scope?.scope_id);
  return `${type}:${id ?? "GLOBAL"}`;
}

export function normalizeScope(scope) {
  return {
    type: normalizeScopeType(scope?.type || scope?.scope_type) || "GLOBAL",
    id: normalizeScopeId(scope?.id ?? scope?.scope_id),
  };
}

export function ensureDefaultScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes.map(normalizeScope) : [];
  return list.length ? list : [DEFAULT_SCOPE];
}

export function getScopesForPermission(user, code) {
  const permCode = normalizePermissionCode(code);
  if (!permCode) return [DEFAULT_SCOPE];
  const map = user?.permissionScopes || {};
  const list = Array.isArray(map[permCode]) ? map[permCode] : [];
  return ensureDefaultScopes(list);
}

export function collectScopesForPermissions(user, codes = []) {
  const permissionSet = new Set((user?.permissions || []).map(normalizePermissionCode));
  const out = [];
  for (const raw of codes || []) {
    const code = normalizePermissionCode(raw);
    if (!code || !permissionSet.has(code)) continue;
    const scopes = getScopesForPermission(user, code);
    out.push(...scopes);
  }
  return out;
}

export function hasGlobalScope(scopes = []) {
  return (scopes || []).some((s) => normalizeScopeType(s?.type) === "GLOBAL");
}

export function hasOrgScope(scopes = []) {
  return (scopes || []).some((s) => {
    const t = normalizeScopeType(s?.type);
    return t && t !== "GLOBAL";
  });
}

export function scopeTypeLabel(type) {
  const t = normalizeScopeType(type);
  if (t === "DIRECTION") return "Direction";
  if (t === "DEPARTEMENT") return "Departement";
  if (t === "SERVICE") return "Service";
  return "Global";
}
