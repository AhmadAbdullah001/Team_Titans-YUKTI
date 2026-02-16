import React from "react";
import { Navigate } from "react-router-dom";
import { getHomePathForRole, getStoredRole } from "../utils/auth.js";

function ProtectedRoute({ children, allowedRoles }) {
  const role = getStoredRole();
  const walletAddress = String(localStorage.getItem("walletAddress") || "").trim();

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  if (!walletAddress) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
