import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { buildChangePasswordRedirectUrl, buildRedirectFromLocation, setPostLoginRedirect } from "../utils/postLoginRedirect";

export default function ForcePasswordChangeGuard() {
  const { loading, auth } = useAuth();
  const location = useLocation();

  if (loading) return null;

  const mustChange = !!auth?.mustChangePassword;
  const isOnChangePage = location.pathname === "/change-password";

  if (mustChange && !isOnChangePage) {
    const redirectTo = buildRedirectFromLocation(location);
    setPostLoginRedirect(redirectTo);
    return <Navigate to={buildChangePasswordRedirectUrl(redirectTo)} replace />;
  }

  return <Outlet />;
}
