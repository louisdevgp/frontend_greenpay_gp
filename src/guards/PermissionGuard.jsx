import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { buildRedirectFromLocation, buildSigninRedirectUrl, setPostLoginRedirect } from "../utils/postLoginRedirect";

export default function PermissionGuard({ allow = /** @type {string[]} */ ([]) }) {
  const { loading, isAuthenticated, hasAnyPermission } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!isAuthenticated) {
    const redirectTo = buildRedirectFromLocation(location);
    setPostLoginRedirect(redirectTo);
    return <Navigate to={buildSigninRedirectUrl(redirectTo)} replace />;
  }

  if (allow.length === 0) return <Outlet />;

  const ok = hasAnyPermission(allow);
  if (!ok) return <Navigate to="/403" replace />;

  return <Outlet />;
}
