import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  getPropertyHistoryOnChain,
  getPropertyOwnerOnChain,
  propertyExistsOnChain,
  verifyPropertyOnChain,
} from "../contract/propertyActions.js";

const API_BASE = "http://localhost:5000";

function BankDashboard() {
  const navigate = useNavigate();
  const [hash, setHash] = useState("");
  const [verified, setVerified] = useState(null);
  const [owner, setOwner] = useState("");
  const [ownerDetails, setOwnerDetails] = useState(null);
  const [history, setHistory] = useState([]);
  const [ipfsLink, setIpfsLink] = useState("");
  const [isActive, setIsActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  };

  const verify = async () => {
    if (!hash.trim()) {
      setMessage("Enter property hash first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [existsOnChain, isVerified, ownerAddress, transferHistory] = await Promise.all([
        propertyExistsOnChain(hash.trim()),
        verifyPropertyOnChain(hash.trim()),
        getPropertyOwnerOnChain(hash.trim()),
        getPropertyHistoryOnChain(hash.trim()),
      ]);

      setIsActive(Boolean(existsOnChain));
      setVerified(Boolean(isVerified));
      setOwner(ownerAddress);
      setHistory(transferHistory || []);

      try {
        const ownerResponse = await fetch(
          `${API_BASE}/api/property/${encodeURIComponent(hash.trim())}?role=bank`,
          { headers: { "x-role": "bank" } }
        );
        const ownerData = await ownerResponse.json();
        if (ownerResponse.ok) {
          setOwnerDetails(ownerData);
        } else {
          setOwnerDetails(null);
        }
      } catch {
        setOwnerDetails(null);
      }

      try {
        const response = await fetch(`${API_BASE}/api/upload/all`);
        const data = await response.json();
        const rows = Array.isArray(data?.files) ? data.files : [];
        const record = rows.find((item) => item.ipfshash === hash.trim());
        if (record) {
          setIpfsLink(`https://gateway.pinata.cloud/ipfs/${record.ipfshash}`);
        } else {
          setIpfsLink("");
        }
      } catch {
        setIpfsLink("");
      }
    } catch (error) {
      setIsActive(null);
      setVerified(null);
      setOwner("");
      setOwnerDetails(null);
      setHistory([]);
      setIpfsLink("");
      setMessage(error?.message || "Failed to verify property");
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
              <h1 className="text-2xl font-bold text-slate-800">Bank Dashboard</h1>
              <p className="text-sm text-slate-500">Verify property hash and owner from blockchain.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/user-lookup"
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-xl hover:bg-sky-700"
              >
                User Lookup
              </Link>
              <Link
                to="/explorer"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xl hover:bg-indigo-700"
              >
                Explorer
              </Link>
              <button
                onClick={logout}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xl hover:bg-rose-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl transition hover:shadow-2xl">
          <h2 className="text-lg font-semibold text-slate-800">Verification Card</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="Enter property hash"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />
            <button
              onClick={verify}
              disabled={loading}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-xl ${
                loading ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
              }`}
            >
              {loading ? "Verifying..." : "Verify"}
            </button>
          </div>

          {message && <p className="mt-3 text-sm text-rose-700">{message}</p>}

          {verified !== null && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Verification:{" "}
                <strong className={verified ? "text-emerald-700" : "text-rose-700"}>
                  {verified ? "Verified" : "Not Verified"}
                </strong>
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Property Status:{" "}
                <strong className={isActive ? "text-emerald-700" : "text-rose-700"}>
                  {isActive ? "Active" : "Inactive / Not Found"}
                </strong>
              </p>
              <p className="mt-2 text-sm text-slate-700">
                Loan Eligibility:{" "}
                <strong className={verified ? "text-emerald-700" : "text-rose-700"}>
                  {verified ? "Verified" : "Not Verified"}
                </strong>
              </p>
              <p className="mt-2 break-all font-mono text-xs text-slate-700">Owner: {owner || "-"}</p>
              {ownerDetails && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-700">Owner Details</p>
                  <p className="mt-1 break-all text-xs text-slate-700">
                    Wallet: <span className="font-mono">{ownerDetails.walletAddress || "-"}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-700">Name: {ownerDetails.name || "-"}</p>
                  <p className="mt-1 text-xs text-slate-700">Role: {ownerDetails.role || "-"}</p>
                  <p className="mt-1 text-xs text-slate-700">Aadhaar: {ownerDetails.aadhaar || "-"}</p>
                </div>
              )}
              {ipfsLink && (
                <a
                  href={ipfsLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs font-semibold text-blue-700 hover:underline"
                >
                  Open Property Document (IPFS)
                </a>
              )}
              <div className="mt-3">
                <p className="text-xs font-semibold text-slate-700">Ownership History</p>
                {history.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500">No transfer records found.</p>
                ) : (
                  <div className="mt-1 space-y-1">
                    {history.map((record, idx) => (
                      <p key={`${record.from}-${record.to}-${idx}`} className="break-all font-mono text-[11px] text-slate-600">
                        {record.from} -> {record.to} at{" "}
                        {record.timestamp ? new Date(record.timestamp * 1000).toLocaleString() : "-"}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BankDashboard;
