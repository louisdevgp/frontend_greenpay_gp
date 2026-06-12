import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PermissionGuard({ allow = /** @type {string[]} */ ([]) }) {
  const { loading, isAuthenticated, hasAnyPermission } = useAuth();

  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/signin" replace />;

  if (allow.length === 0) return <Outlet />;

  const ok = hasAnyPermission(allow);
  if (!ok) return <Navigate to="/403" replace />;

  return <Outlet />;
}
