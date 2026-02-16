import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { getHomePathForRole } from "../utils/auth.js";

const API_BASE = "http://localhost:5000";

function Login() {
  const navigate = useNavigate();
  const [role, setRole] = useState("citizen");
  const [aadhaar, setAadhaar] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const payload = { role, password };

      if (role === "citizen") {
        if (!/^[0-9]{12}$/.test(aadhaar)) {
          throw new Error("Aadhaar must be exactly 12 digits");
        }
        payload.aadhaar = aadhaar;
      } else {
        if (!employeeId.trim()) {
          throw new Error("Employee ID is required");
        }
        payload.employeeId = employeeId.trim();
      }

      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Login failed");
      }

      const user = data?.user;
      if (!user?.role) {
        throw new Error("Login response missing user role");
      }

      if (!window.ethereum) {
        throw new Error("MetaMask is required. Please install MetaMask and try again.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      const saveWalletResponse = await fetch(`${API_BASE}/api/auth/save-wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id || user._id,
          walletAddress,
        }),
      });
      let saveWalletData = null;
      try {
        saveWalletData = await saveWalletResponse.json();
      } catch {
        saveWalletData = null;
      }
      if (!saveWalletResponse.ok) {
        throw new Error(saveWalletData?.error || "Failed to save wallet address");
      }

      const userWithWallet = saveWalletData?.user || { ...user, walletAddress };
      localStorage.setItem("user", JSON.stringify(userWithWallet));
      localStorage.setItem("role", userWithWallet.role);
      localStorage.setItem("walletAddress", walletAddress);
      navigate(getHomePathForRole(user.role), { replace: true });
    } catch (err) {
      if (err?.name === "TypeError") {
        setError("Cannot reach server at http://localhost:5000. Start backend and try again.");
      } else {
        setError(err?.message || "Login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-xl border border-white/10 bg-white/10 p-8 shadow-xl backdrop-blur">
          <h1 className="text-3xl font-bold text-white">Login</h1>
          <p className="mt-2 text-sm text-slate-200">Access your eVault workspace.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="citizen">Citizen</option>
                <option value="registrar">Registrar</option>
                <option value="notary">Notary</option>
                <option value="localAuthority">Local Authority</option>
              </select>
            </div>
            {role === "citizen" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-100">Aadhaar Number</label>
                <input
                  type="text"
                  value={aadhaar}
                  onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, "").slice(0, 12))}
                  required
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-cyan-400"
                  placeholder="12-digit Aadhaar"
                  inputMode="numeric"
                  pattern="[0-9]{12}"
                />
              </div>
            ) : (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-100">Employee ID</label>
                <input
                  type="text"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-cyan-400"
                  placeholder="Enter Employee ID"
                />
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-cyan-400"
                placeholder="********"
              />
            </div>

            {error && <p className="text-sm text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 font-semibold text-white shadow-xl transition hover:from-cyan-400 hover:to-blue-500 ${
                loading ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-200">
            No account?{" "}
            <Link to="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
