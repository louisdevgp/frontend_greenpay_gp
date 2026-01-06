// src/guards/RoleGuard.jsx
import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RoleGuard({ allow = [] }) {
  const { loading, isAuthenticated, hasAnyRole } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/signin" replace />;

  // allow vide => tout utilisateur connecté autorisé
  if (allow.length === 0) return <Outlet />;

  const ok = hasAnyRole(allow);
  if (!ok) return <Navigate to="/403" replace />;

  return <Outlet />;
}
