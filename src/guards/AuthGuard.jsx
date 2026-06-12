import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function AuthGuard() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) return null; // tu peux remplacer par un Loader TailAdmin
  if (!isAuthenticated) return <Navigate to="/signin" replace />;

  return <Outlet />;
}
