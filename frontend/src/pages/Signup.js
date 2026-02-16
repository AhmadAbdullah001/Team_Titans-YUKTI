import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";

const API_BASE = "http://localhost:5000";

function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    role: "citizen",
    aadhaar: "",
    employeeId: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!window.ethereum) {
        throw new Error("MetaMask is required. Please install MetaMask and try again.");
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const walletAddress = await signer.getAddress();

      const payload = {
        name: form.name.trim(),
        role: form.role,
        password: form.password,
        walletAddress,
      };

      if (form.role === "citizen") {
        if (!/^[0-9]{12}$/.test(form.aadhaar)) {
          throw new Error("Aadhaar must be exactly 12 digits");
        }
        payload.aadhaar = form.aadhaar.trim();
      } else {
        if (!form.employeeId.trim()) {
          throw new Error("Employee ID is required");
        }
        payload.employeeId = form.employeeId.trim();
      }

      const response = await fetch(`${API_BASE}/api/auth/signup`, {
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
        throw new Error(data?.message || data?.error || "Signup failed");
      }

      navigate("/login", { replace: true });
    } catch (err) {
      if (err?.name === "TypeError") {
        setError("Cannot reach server at http://localhost:5000. Start backend and try again.");
      } else {
        setError(err?.message || "Signup failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-cyan-900 px-4 py-10">
      <div className="mx-auto flex min-h-[80vh] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-xl border border-white/10 bg-white/10 p-8 shadow-xl backdrop-blur">
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="mt-2 text-sm text-slate-200">Role-based signup with secure credentials.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                required
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-cyan-400"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-100">Role</label>
              <select
                value={form.role}
                onChange={(e) => updateField("role", e.target.value)}
                className="w-full rounded-xl border border-white/20 bg-slate-900 px-4 py-3 text-white outline-none transition focus:border-cyan-400"
              >
                <option value="citizen">Citizen</option>
                <option value="registrar">Registrar</option>
                <option value="notary">Notary</option>
                <option value="localAuthority">Local Authority</option>
              </select>
            </div>
            {form.role === "citizen" ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-100">Aadhaar Number</label>
                <input
                  type="text"
                  value={form.aadhaar}
                  onChange={(e) => updateField("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))}
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
                  value={form.employeeId}
                  onChange={(e) => updateField("employeeId", e.target.value)}
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
                value={form.password}
                onChange={(e) => updateField("password", e.target.value)}
                required
                minLength={6}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-slate-300 outline-none transition focus:border-cyan-400"
                placeholder="At least 6 characters"
              />
            </div>
            {error && <p className="text-sm text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className={`w-full rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 px-4 py-3 font-semibold text-white shadow-xl transition hover:from-emerald-400 hover:to-cyan-500 ${
                loading ? "cursor-not-allowed opacity-70" : ""
              }`}
            >
              {loading ? "Creating account..." : "Signup"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-200">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
              Login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;
