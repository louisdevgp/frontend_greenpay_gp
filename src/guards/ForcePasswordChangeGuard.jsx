import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ForcePasswordChangeGuard() {
  const { loading, auth } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const mustChange = !!auth?.mustChangePassword;
  const isOnChangePage = location.pathname === "/change-password";

  if (mustChange && !isOnChangePage) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
