import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  getPropertyHistoryOnChain,
  getPropertyOwnerOnChain,
  propertyExistsOnChain,
  verifyPropertyOnChain,
} from "../contract/propertyActions.js";

const API_BASE = "http://localhost:5000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

async function parseJsonSafe(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `API did not return JSON. Response started with: ${text.slice(0, 40)}`
    );
  }
  return response.json();
}

function maskHash(hash) {
  const value = String(hash || "").trim();
  if (!value) return "-";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function maskValue(value) {
  const text = String(value || "").trim();
  if (!text) return "-";
  if (text.length <= 10) return text;
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function formatDateTime(value) {
  if (!value) return "----";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "----";
  return date.toLocaleString();
}

function RegistrarDashboard() {
  const navigate = useNavigate();
  const currentRole = String(localStorage.getItem("role") || "").trim();
  const normalizedRole = currentRole === "localAuthority" ? "localauthority" : currentRole.toLowerCase();
  const isReviewerRole = ["registrar", "notary", "localauthority"].includes(normalizedRole);
  const roleLabel =
    currentRole === "localAuthority"
      ? "Local Authority"
      : currentRole
      ? currentRole.charAt(0).toUpperCase() + currentRole.slice(1)
      : "Registrar";
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [processingHash, setProcessingHash] = useState("");
  const [historyByHash, setHistoryByHash] = useState({});
  const [loadingHistoryHash, setLoadingHistoryHash] = useState("");
  const [searchHash, setSearchHash] = useState("");
  const [searchingOwner, setSearchingOwner] = useState(false);
  const [ownerDetails, setOwnerDetails] = useState(null);
  const [ownerSearchMessage, setOwnerSearchMessage] = useState("");
  const [walletLabels, setWalletLabels] = useState({});

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  };

  const loadFiles = async () => {
    if (!isReviewerRole) {
      setActionMessage("Only registrar, notary, and local authority can review requests.");
      setFiles([]);
      return;
    }
    setLoading(true);
    try {
      let response = await fetch(`${API_BASE}/api/files?role=${encodeURIComponent(currentRole)}`, {
        headers: { "x-role": currentRole },
      });
      let data;

      try {
        data = await parseJsonSafe(response);
      } catch {
        // Backward-compatible fallback to existing upload listing endpoint.
        response = await fetch(`${API_BASE}/api/upload/all`);
        data = await parseJsonSafe(response);
      }

      if (!response.ok) {
        throw new Error(data?.message || "Failed to fetch files");
      }

      const rows = Array.isArray(data?.files) ? data.files : [];
      const withStatus = await Promise.all(
        rows.map(async (item) => {
          let existsOnChain = null;
          let verifiedOnChain = false;
          let currentOwnerWallet = item.currentOwnerWallet || null;
          let transferHistoryCount = null;

          try {
            existsOnChain = await propertyExistsOnChain(item.ipfshash);
          } catch {
            existsOnChain = null;
          }

          try {
            verifiedOnChain = await verifyPropertyOnChain(item.ipfshash);
          } catch {
            verifiedOnChain = false;
          }

          try {
            currentOwnerWallet = await getPropertyOwnerOnChain(item.ipfshash);
          } catch {
            // no-op
          }

          try {
            const history = await getPropertyHistoryOnChain(item.ipfshash);
            transferHistoryCount = Array.isArray(history)
              ? history.filter((record) => {
                  const from = String(record?.from || "").toLowerCase();
                  const to = String(record?.to || "").toLowerCase();
                  return from && to && from !== ZERO_ADDRESS && to !== ZERO_ADDRESS;
                }).length
              : 0;
          } catch {
            transferHistoryCount = null;
          }

          return {
            ...item,
            existsOnChain,
            verifiedOnChain: Boolean(verifiedOnChain),
            currentOwnerWallet,
            transferHistoryCount,
          };
        })
      );
      setFiles(withStatus);
    } catch (error) {
      setActionMessage(
        error?.message ||
          "Failed to load files. Ensure backend is running on http://localhost:5000."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reviewRequest = async (hash, decision, rejectionReason = "") => {
    try {
      setProcessingHash(hash);
      setActionMessage(
        decision === "approve" ? "Submitting approval..." : "Submitting rejection..."
      );

      const response = await fetch(`${API_BASE}/api/files/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-role": currentRole },
        body: JSON.stringify({
          hash,
          role: currentRole,
          reviewerWallet: localStorage.getItem("walletAddress") || null,
          decision,
          rejectionReason: rejectionReason || null,
        }),
      });
      const contentType = response.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const raw = await response.text();
        if (response.status === 404) {
          throw new Error(
            "Review API not found. Restart backend so /api/files/review route is loaded."
          );
        }
        throw new Error(
          `Review API returned non-JSON response (status ${response.status}). Response starts with: ${raw
            .replace(/\s+/g, " ")
            .slice(0, 80)}`
        );
      }
      if (!response.ok) {
        throw new Error(data?.message || "Failed to submit review");
      }

      setActionMessage(data?.message || "Review submitted.");
      await loadFiles();
    } catch (error) {
      setActionMessage(error?.message || "Review failed");
    } finally {
      setProcessingHash("");
    }
  };

  const handleReject = (hash) => {
    const reason = window.prompt("Enter rejection reason (mandatory):", "");
    if (!reason || !String(reason).trim()) {
      setActionMessage("Rejection reason is required.");
      return;
    }
    reviewRequest(hash, "reject", String(reason).trim());
  };

  const resolveWalletLabel = async (wallet) => {
    const normalized = String(wallet || "").trim().toLowerCase();
    if (!normalized || normalized === ZERO_ADDRESS) return "System";
    if (walletLabels[normalized]) return walletLabels[normalized];

    try {
      const response = await fetch(
        `${API_BASE}/api/auth/user-by-wallet/${encodeURIComponent(normalized)}?role=${encodeURIComponent(currentRole)}`,
        { headers: { "x-role": currentRole } }
      );
      const data = await parseJsonSafe(response);
      if (response.ok && data?.user?.name) {
        const label = `${data.user.name} (${maskValue(normalized)})`;
        setWalletLabels((prev) => ({ ...prev, [normalized]: label }));
        return label;
      }
    } catch {
      // fallback below
    }

    const fallback = maskValue(normalized);
    setWalletLabels((prev) => ({ ...prev, [normalized]: fallback }));
    return fallback;
  };

  const loadHistory = async (item) => {
    const hash = String(item?.ipfshash || "").trim();
    if (!hash) return;

    try {
      setLoadingHistoryHash(hash);
      const timeline = [];

      timeline.push(
        `${formatDateTime(item?.uploadedAt)} - Requested (${String(item?.userID || "Citizen")})`
      );

      const decisionRows = Object.entries(item?.roleDecisions || {})
        .map(([role, value]) => ({
          role,
          decision: value?.decision || null,
          reason: value?.reason || null,
          by: value?.by || null,
          at: value?.at || null,
        }))
        .filter((row) => row.decision && row.at)
        .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

      for (const row of decisionRows) {
        const actor = row.by ? await resolveWalletLabel(row.by) : row.role;
        const roleLabelText =
          row.role === "localAuthority"
            ? "Local Authority"
            : row.role.charAt(0).toUpperCase() + row.role.slice(1);
        if (row.decision === "approve") {
          timeline.push(`${formatDateTime(row.at)} - Approved by ${roleLabelText} (${actor})`);
        } else {
          timeline.push(
            `${formatDateTime(row.at)} - Rejected by ${roleLabelText} (${actor})${
              row.reason ? ` | Reason: ${row.reason}` : ""
            }`
          );
        }
      }

      if (item?.chainPushedAt) {
        timeline.push(
          `${formatDateTime(item.chainPushedAt)} - Registered on Blockchain${
            item.chainTxHash ? ` (Tx: ${maskValue(item.chainTxHash)})` : ""
          }`
        );
      }

      try {
        const chainHistory = await getPropertyHistoryOnChain(hash);
        const chainRows = Array.isArray(chainHistory) ? chainHistory : [];
        for (const record of chainRows) {
          const from = String(record?.from || "").toLowerCase();
          const to = String(record?.to || "").toLowerCase();
          const ts = Number(record?.timestamp || 0);
          if (!to || to === ZERO_ADDRESS) continue;
          const toLabel = await resolveWalletLabel(to);
          if (!from || from === ZERO_ADDRESS) {
            timeline.push(
              `${formatDateTime(ts ? ts * 1000 : null)} - Registered (${toLabel})`
            );
          } else {
            const fromLabel = await resolveWalletLabel(from);
            timeline.push(
              `${formatDateTime(ts ? ts * 1000 : null)} - Transferred (${fromLabel} -> ${toLabel})`
            );
          }
        }
      } catch {
        // chain history optional
      }

      if (item?.workflowStatus === "rejected") {
        timeline.push(`${formatDateTime(Date.now())} - Final Status: Rejected`);
      } else if (item?.workflowStatus === "approved") {
        timeline.push(`${formatDateTime(Date.now())} - Final Status: Approved`);
      }

      setHistoryByHash((prev) => ({ ...prev, [hash]: timeline }));
    } catch (error) {
      setActionMessage(error?.message || "Failed to fetch property history");
    } finally {
      setLoadingHistoryHash("");
    }
  };

  const searchOwnerByHash = async () => {
    const value = String(searchHash || "").trim();
    if (!value) {
      setOwnerSearchMessage("Enter property hash first.");
      setOwnerDetails(null);
      return;
    }

    try {
      setSearchingOwner(true);
      setOwnerSearchMessage("");
      setOwnerDetails(null);

      const response = await fetch(
        `${API_BASE}/api/property/${encodeURIComponent(value)}?role=${encodeURIComponent(currentRole)}`,
        { headers: { "x-role": currentRole } }
      );
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to search property owner");
      }

      setOwnerDetails(data);
    } catch (error) {
      setOwnerSearchMessage(error?.message || "Failed to search owner by hash.");
    } finally {
      setSearchingOwner(false);
    }
  };

  const copyHash = async (hash) => {
    const value = String(hash || "").trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setActionMessage("Property hash copied.");
    } catch {
      setActionMessage("Copy failed. Please copy manually.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-slate-50 to-sky-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{roleLabel} Dashboard</h1>
              <p className="text-sm text-slate-600">
                Review requests. 2 approvals -> on-chain push. 2 rejects -> rejected.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/user-lookup"
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-sky-700"
              >
                User Lookup
              </Link>
              <Link
                to="/explorer"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
              >
                Explorer
              </Link>
              <button
                onClick={logout}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-rose-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">


          <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Search By Property Hash</h2>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={searchHash}
                onChange={(e) => setSearchHash(e.target.value)}
                placeholder="Enter property hash"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500"
              />
              <button
                onClick={searchOwnerByHash}
                disabled={searchingOwner}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${
                  searchingOwner ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {searchingOwner ? "Searching..." : "Search"}
              </button>
            </div>
            {ownerSearchMessage && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {ownerSearchMessage}
              </p>
            )}
            {ownerDetails && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">Owner Details</p>
                <p className="mt-2 break-all text-xs text-slate-700">
                  Wallet: <span className="font-mono">{ownerDetails.walletAddress || "-"}</span>
                </p>
                <p className="mt-1 text-xs text-slate-700">Name: {ownerDetails.name || "-"}</p>
                <p className="mt-1 text-xs text-slate-700">Role: {ownerDetails.role || "-"}</p>
                <p className="mt-1 text-xs text-slate-700">Aadhaar: {ownerDetails.aadhaar || "-"}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Property Queue</h2>
          <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-900">
            <p className="font-semibold">{roleLabel} Workflow</p>
            <p className="mt-1">
              1) Any 2 approvals from registrar/notary/local authority will push hash on-chain.
            </p>
            <p className="mt-1">
              2) If 2 rejects are received, request becomes rejected.
            </p>
            <p className="mt-1">
              3) Each role can submit only one decision per request.
            </p>
          </div>
          {actionMessage && (
            <p className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
              {actionMessage}
            </p>
          )}
          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading documents...</p>
          ) : files.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No uploaded files found.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">File</th>
                    <th className="px-3 py-2">Owner ID</th>
                    <th className="px-3 py-2">Hash</th>
                    <th className="px-3 py-2">Current Owner</th>
                     <th className="px-3 py-2">Workflow</th>
                     <th className="px-3 py-2">Status</th>
                     <th className="px-3 py-2">Approvals</th>
                     <th className="px-3 py-2">Rejects</th>
                     <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {files.map((item) => (
                    <React.Fragment key={item._id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-sm text-slate-800">{item.filename}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => copyHash(item.userID)}
                          title={item.userID}
                          className="text-sm text-slate-700 underline decoration-dotted underline-offset-2 hover:text-indigo-700"
                        >
                          {maskValue(item.userID)}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => copyHash(item.ipfshash)}
                          title={item.ipfshash}
                          className="font-mono text-xs text-slate-700 underline decoration-dotted underline-offset-2 hover:text-indigo-700"
                        >
                          {maskHash(item.ipfshash)}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => copyHash(item.currentOwnerWallet)}
                          title={item.currentOwnerWallet || "-"}
                          className="font-mono text-xs text-slate-700 underline decoration-dotted underline-offset-2 hover:text-indigo-700"
                        >
                          {maskValue(item.currentOwnerWallet)}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">
                        {item.workflowStatus || "pending"}
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <span
                          className={
                            item.verified || item.verifiedOnChain
                              ? "text-emerald-700 font-medium"
                              : item.existsOnChain === false
                              ? "text-rose-700 font-medium"
                              : item.existsOnChain
                              ? "text-amber-700 font-medium"
                              : "text-amber-700 font-medium"
                          }
                        >
                          {item.verified || item.verifiedOnChain
                            ? "Verified"
                            : item.workflowStatus === "rejected"
                            ? "Rejected"
                            : "Pending Review"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">{Number(item.approvalCount || 0)}</td>
                      <td className="px-3 py-2 text-xs text-slate-700">{Number(item.rejectCount || 0)}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-2">
                          <a
                            href={`https://gateway.pinata.cloud/ipfs/${item.ipfshash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-center text-xs font-semibold text-white hover:bg-indigo-700"
                          >
                            View Document
                          </a>
                          <button
                            onClick={() => reviewRequest(item.ipfshash, "approve")}
                            disabled={
                              !isReviewerRole ||
                              item.workflowStatus === "approved" ||
                              item.workflowStatus === "rejected" ||
                              processingHash === item.ipfshash ||
                              Boolean(item?.roleDecisions?.[currentRole]?.decision)
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                              !isReviewerRole ||
                              item.workflowStatus === "approved" ||
                              item.workflowStatus === "rejected" ||
                              processingHash === item.ipfshash ||
                              Boolean(item?.roleDecisions?.[currentRole]?.decision)
                                ? "cursor-not-allowed bg-slate-400"
                                : "bg-amber-600 hover:bg-amber-700"
                            }`}
                          >
                            {processingHash === item.ipfshash ? "Approving..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReject(item.ipfshash)}
                            disabled={
                              !isReviewerRole ||
                              item.workflowStatus === "approved" ||
                              item.workflowStatus === "rejected" ||
                              processingHash === item.ipfshash ||
                              Boolean(item?.roleDecisions?.[currentRole]?.decision)
                            }
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                              !isReviewerRole ||
                              item.workflowStatus === "approved" ||
                              item.workflowStatus === "rejected" ||
                              processingHash === item.ipfshash ||
                              Boolean(item?.roleDecisions?.[currentRole]?.decision)
                                ? "cursor-not-allowed bg-slate-400"
                                : "bg-rose-600 hover:bg-rose-700"
                            }`}
                          >
                            {processingHash === item.ipfshash ? "Submitting..." : "Reject"}
                          </button>
                          <button
                            onClick={() => loadHistory(item)}
                            disabled={loadingHistoryHash === item.ipfshash}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                              loadingHistoryHash === item.ipfshash
                                ? "cursor-not-allowed bg-slate-400"
                                : "bg-sky-600 hover:bg-sky-700"
                            }`}
                          >
                            {loadingHistoryHash === item.ipfshash ? "Loading..." : "View History"}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {historyByHash[item.ipfshash] && (
                      <tr>
                        <td colSpan={9} className="bg-slate-50 px-3 py-2">
                          <p className="text-xs font-semibold text-slate-700">Transfer History</p>
                          {historyByHash[item.ipfshash].length === 0 ? (
                            <p className="text-xs text-slate-500">No transfer records.</p>
                          ) : (
                            <div className="mt-1 space-y-1">
                              {historyByHash[item.ipfshash].map((record, idx) => (
                                <p key={`${item.ipfshash}-${idx}`} className="break-all font-mono text-[11px] text-slate-600">
                                  {record}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default RegistrarDashboard;
