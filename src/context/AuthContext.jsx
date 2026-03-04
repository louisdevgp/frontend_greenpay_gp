// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuth, getAuth, login as apiLogin, me as apiMe, setAuth } from "../services/auth.service";
import { setApiToken } from "../services/api";

/**
 * @typedef {{
 *  accessToken?: string,
 *  refreshToken?: string,
 *  user?: any,
 *  mustChangePassword?: boolean,
 *  persist?: boolean
 * }} AuthState
 */

/**
 * @typedef {{
 *  loading: boolean,
 *  isAuthenticated: boolean,
 *  auth: (AuthState|null),
 *  user: any,
 *  roles: string[],
 *  login: (args: { email: string, password: string, persist?: boolean }) => Promise<AuthState>,
 *  logout: () => void,
 *  refreshMe: () => Promise<any>,
 *  hasRole: (roleName: string) => boolean,
 *  hasAnyRole: (roleList?: string[]) => boolean,
 *  permissions: string[],
 *  hasPermission: (code: string) => boolean,
 *  hasAnyPermission: (codes?: string[]) => boolean
 * }} AuthContextValue
 */

const AuthContext = createContext(/** @type {AuthContextValue|null} */ (null));

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuthState] = useState(() => getAuth()); // { accessToken, refreshToken, user, mustChangePassword? }

  const isAuthenticated = !!auth?.accessToken;
  const user = auth?.user || null;
  const roles = user?.roles || [];
  const permissions = user?.permissions || [];

  // 🔄 Au chargement: si token existe → /me pour valider et refresh user
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const persisted = getAuth();
        if (!persisted?.accessToken) {

          setApiToken(null);
          setLoading(false);
          return;
        }

        setApiToken(persisted.accessToken);
        // Vérifie le token et récupère user propre via /me
        try {
          const res = await apiMe(); // { success, data }
          if (res?.success && res?.data) {
            const updatedUser = res.data;
            const next = { ...persisted, user: updatedUser };
            setAuth(next);
            setAuthState(next);

            setApiToken(next.accessToken);
          } else {
            clearAuth();
            setAuthState(null);

            setApiToken(null);
          }
        } catch (e) {
          // If backend requires password change, keep auth in storage
          if (e?.status === 403 && String(e?.message) === "PASSWORD_CHANGE_REQUIRED") {
            const next = { ...persisted, mustChangePassword: true };
            setAuth(next);
            setAuthState(next);

            setApiToken(next.accessToken);
          } else {
            throw e;
          }
        }
      } catch (e) {
        // token invalide / expiré / réseau
        clearAuth();
        setAuthState(null);

        setApiToken(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async ({ email, password, persist = true }) => {
    // persist: tu peux plus tard gérer sessionStorage si tu veux.
    // Là on garde localStorage simple.
    const res = await apiLogin({ email, password });

    // Ton backend renvoie:
    // { success, data: { user, accessToken, refreshToken } }
    if (!res?.success) {
      throw new Error(res?.message || "Login failed");
    }

    const payload = res.data;
    const next = {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      user: payload.user,
      mustChangePassword: !!payload.mustChangePassword,
      persist,
    };

    setAuth(next);
    setAuthState(next);

    setApiToken(next.accessToken);

    // refresh user from /users/me (adds delegatedRoles + permissions)
    try {
      const meRes = await apiMe();
      if (meRes?.success && meRes?.data) {
        const refreshed = { ...next, user: meRes.data };
        setAuth(refreshed);
        setAuthState(refreshed);

        setApiToken(refreshed.accessToken);
        return refreshed;
      }
    } catch {
      // ignore: keep login payload
    }

    return next;
  };

  const logout = () => {
    clearAuth();
    setAuthState(null);

    setApiToken(null);
  };

  const refreshMe = async () => {
    const res = await apiMe();
    if (!res?.success) throw new Error(res?.message || "ME failed");

    const current = getAuth();
    const next = { ...current, user: res.data };
    setAuth(next);
    setAuthState(next);

    setApiToken(next.accessToken);
    return next.user;
  };

  const hasRole = (roleName) => roles.includes(roleName);
  const hasAnyRole = (roleList = []) => roleList.some((r) => roles.includes(r));

  const hasPermission = (code) => permissions.includes(code);
  const hasAnyPermission = (codes = []) => codes.some((c) => permissions.includes(c));

  const value = useMemo(
    () => ({
      loading,
      isAuthenticated,
      auth,
      user,
      roles,
      login,
      logout,
      refreshMe,
      hasRole,
      hasAnyRole,
      permissions,
      hasPermission,
      hasAnyPermission,
    }),
    [loading, isAuthenticated, auth, user, roles, permissions]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
