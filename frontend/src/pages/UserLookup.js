import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";

const API_BASE = "http://localhost:5000";

function UserLookup() {
  const navigate = useNavigate();
  const role = String(localStorage.getItem("role") || "").toLowerCase();
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("walletAddress");
    navigate("/login", { replace: true });
  };

  const search = async () => {
    const value = String(wallet || "").trim();
    if (!value) {
      setError("Enter wallet address first.");
      setUser(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setUser(null);

      const response = await fetch(
        `${API_BASE}/api/auth/user-by-wallet/${encodeURIComponent(value)}?role=${encodeURIComponent(role)}`,
        { headers: { "x-role": role } }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to fetch user details");
      }

      setUser(data?.user || null);
    } catch (e) {
      setError(e?.message || "Failed to fetch user details");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">User Lookup</h1>
              <p className="text-sm text-slate-500">Search user details by wallet address.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/home"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Back
              </Link>
              <button
                onClick={logout}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              placeholder="Enter wallet address"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={search}
              disabled={loading}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white ${
                loading ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Searching..." : "Search"}
            </button>
          </div>

          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

          {user && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">Name: <strong>{user.name || "-"}</strong></p>
              <p className="mt-2 text-sm text-slate-700">Role: <strong>{user.role || "-"}</strong></p>
              <p className="mt-2 text-sm text-slate-700">Aadhaar: <strong>{user.aadhaar || "-"}</strong></p>
              <p className="mt-2 text-sm text-slate-700">
                Employee ID: <strong>{user.employeeId || "-"}</strong>
              </p>
              <p className="mt-2 break-all font-mono text-xs text-slate-700">
                Wallet: {user.walletAddress || "-"}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Created: {user.createdAt ? new Date(user.createdAt).toLocaleString() : "-"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UserLookup;
