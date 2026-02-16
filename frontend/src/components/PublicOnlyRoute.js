import React from "react";
import { Navigate } from "react-router-dom";
import { getHomePathForRole, getStoredRole } from "../utils/auth.js";

function PublicOnlyRoute({ children }) {
  const role = getStoredRole();
  const walletAddress = String(localStorage.getItem("walletAddress") || "").trim();

  if (role && walletAddress) {
    return <Navigate to={getHomePathForRole(role)} replace />;
  }

  return children;
}

export default PublicOnlyRoute;
