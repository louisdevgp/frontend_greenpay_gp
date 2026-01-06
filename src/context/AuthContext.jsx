// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { clearAuth, getAuth, login as apiLogin, me as apiMe, setAuth } from "../services/auth.service";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [auth, setAuthState] = useState(() => getAuth()); // { accessToken, refreshToken, user }

  console.log("Auth state initialized:", auth);

  const isAuthenticated = !!auth?.accessToken;
  const user = auth?.user || null;
  const roles = user?.roles || [];

  // 🔄 Au chargement: si token existe → /me pour valider et refresh user
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const persisted = getAuth();
        if (!persisted?.accessToken) {
          setLoading(false);
          return;
        }

        // Vérifie le token et récupère user propre via /me
        const res = await apiMe(); // { success, data }
        if (res?.success && res?.data) {
          const updatedUser = res.data;
          const next = { ...persisted, user: updatedUser };
          setAuth(next);
          setAuthState(next);
        } else {
          clearAuth();
          setAuthState(null);
        }
      } catch (e) {
        // token invalide / expiré / réseau
        clearAuth();
        setAuthState(null);
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
      persist,
    };

    setAuth(next);
    setAuthState(next);

    return next;
  };

  const logout = () => {
    clearAuth();
    setAuthState(null);
  };

  const refreshMe = async () => {
    const res = await apiMe();
    if (!res?.success) throw new Error(res?.message || "ME failed");

    const current = getAuth();
    const next = { ...current, user: res.data };
    setAuth(next);
    setAuthState(next);
    return next.user;
  };

  const hasRole = (roleName) => roles.includes(roleName);
  const hasAnyRole = (roleList = []) => roleList.some((r) => roles.includes(r));

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
    }),
    [loading, isAuthenticated, auth, user, roles]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
