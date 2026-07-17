import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { buildRedirectFromLocation, buildSigninRedirectUrl, setPostLoginRedirect } from "../utils/postLoginRedirect";

export default function AuthGuard() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return null; // tu peux remplacer par un Loader TailAdmin
  if (!isAuthenticated) {
    const redirectPath = buildRedirectFromLocation(location);
    setPostLoginRedirect(redirectPath);
    return <Navigate to={buildSigninRedirectUrl(redirectPath)} replace />;
  }

  return <Outlet />;
}
