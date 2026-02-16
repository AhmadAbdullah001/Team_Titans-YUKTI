import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import NavLayout from "./components/NavLayout.js";
import ConnectWallet from "./pages/ConnectWallet.js";
import RegisterProperty from "./pages/RegisterProperty.js";
import ApprovalDashboard from "./pages/ApprovalDashboard.js";
import PropertyDashboard from "./pages/PropertyDashboard.js";
import OwnershipTimeline from "./pages/OwnershipTimeline.js";
import TransferProperty from "./pages/TransferProperty.js";
import Login from "./pages/Login.js";
import Signup from "./pages/Signup.js";
import CitizenDashboard from "./pages/CitizenDashboard.js";
import RegistrarDashboard from "./pages/RegistrarDashboard.js";
import PropertyExplorer from "./pages/PropertyExplorer.js";
import UserLookup from "./pages/UserLookup.js";
import ProtectedRoute from "./components/ProtectedRoute.js";
import PublicOnlyRoute from "./components/PublicOnlyRoute.js";
import { getHomePathForRole, getStoredRole } from "./utils/auth.js";

function RoleHomeRedirect() {
  const role = getStoredRole();
  return <Navigate to={getHomePathForRole(role)} replace />;
}

function Web3Page({ children }) {
  return <NavLayout>{children}</NavLayout>;
}

function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <Login />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicOnlyRoute>
            <Signup />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/citizen"
        element={
          <ProtectedRoute allowedRoles={["citizen"]}>
            <CitizenDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/registrar"
        element={
          <ProtectedRoute allowedRoles={["registrar"]}>
            <RegistrarDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notary"
        element={
          <ProtectedRoute allowedRoles={["notary"]}>
            <RegistrarDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/local-authority"
        element={
          <ProtectedRoute allowedRoles={["localAuthority"]}>
            <RegistrarDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/explorer"
        element={
          <ProtectedRoute allowedRoles={["citizen", "registrar", "notary", "localAuthority"]}>
            <PropertyExplorer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/user-lookup"
        element={
          <ProtectedRoute allowedRoles={["registrar", "notary", "localAuthority"]}>
            <UserLookup />
          </ProtectedRoute>
        }
      />

      <Route
        path="/web3/connect"
        element={
          <Web3Page>
            <ConnectWallet />
          </Web3Page>
        }
      />
      <Route
        path="/web3/register"
        element={
          <Web3Page>
            <RegisterProperty />
          </Web3Page>
        }
      />
      <Route
        path="/web3/approvals"
        element={
          <Web3Page>
            <ApprovalDashboard />
          </Web3Page>
        }
      />
      <Route
        path="/web3/properties"
        element={
          <Web3Page>
            <PropertyDashboard />
          </Web3Page>
        }
      />
      <Route
        path="/web3/timeline"
        element={
          <Web3Page>
            <OwnershipTimeline />
          </Web3Page>
        }
      />
      <Route
        path="/web3/transfer"
        element={
          <Web3Page>
            <TransferProperty />
          </Web3Page>
        }
      />

      <Route path="/home" element={<RoleHomeRedirect />} />
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
