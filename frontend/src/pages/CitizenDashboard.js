import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import {
  getPropertyStateOnChain,
  pushHashOnChainWithWallet,
  transferPropertyOnChain,
} from "../contract/propertyActions.js";

const API_BASE = "http://localhost:5000";

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function getUserIdentifiers(user) {
  const values = [user?.email, user?.id, user?._id]
    .filter(Boolean)
    .map((v) => String(v));
  return Array.from(new Set(values));
}

function getRejectionReasons(item) {
  const decisions = item?.roleDecisions || {};
  return Object.entries(decisions)
    .filter(([, value]) => value?.decision === "reject")
    .map(([role, value]) => ({
      role,
      reason: String(value?.reason || "").trim(),
    }))
    .filter((row) => row.reason);
}

function CitizenDashboard() {
  const navigate = useNavigate();
  const user = useMemo(() => getStoredUser(), []);
  const userIdentifiers = useMemo(() => getUserIdentifiers(user), [user]);
  const connectedWalletAddress = useMemo(
    () => String(localStorage.getItem("walletAddress") || "").trim().toLowerCase(),
    []
  );
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [myFiles, setMyFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [transferCodeByHash, setTransferCodeByHash] = useState({});
  const [resolvedBuyerByHash, setResolvedBuyerByHash] = useState({});
  const [resolvingCodeHash, setResolvingCodeHash] = useState("");
  const [transferringHash, setTransferringHash] = useState("");
  const [pushingHash, setPushingHash] = useState("");
  const [generatingCode, setGeneratingCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState(null);
  const REGISTERED = 2;

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    localStorage.removeItem("walletAddress");
    navigate("/login", { replace: true });
  };

  const loadMyFiles = async () => {
    if (userIdentifiers.length === 0) return;
    const primaryUserId = encodeURIComponent(userIdentifiers[0]);
    const idsQuery = encodeURIComponent(userIdentifiers.join(","));
    const emailQuery = encodeURIComponent(user?.email || "");
    const nameQuery = encodeURIComponent(user?.name || "");
    const walletQuery = encodeURIComponent(connectedWalletAddress || "");
    setLoadingFiles(true);
    try {
      let response = await fetch(
        `${API_BASE}/api/files/${primaryUserId}?role=citizen&ids=${idsQuery}&email=${emailQuery}&name=${nameQuery}&walletAddress=${walletQuery}`,
        { headers: { "x-role": "citizen" } }
      );
      let data;

      try {
        data = await parseJsonSafe(response);
      } catch {
        // Backward-compatible fallback endpoint if new files route is unavailable.
        response = await fetch(`${API_BASE}/api/upload/all`);
        data = await parseJsonSafe(response);
      }

      const rows = Array.isArray(data?.files) ? data.files : [];
      let filteredRows = rows;

      if (filteredRows.length === 0) {
        response = await fetch(`${API_BASE}/api/upload/all`);
        data = await parseJsonSafe(response);
        const fallbackRows = Array.isArray(data?.files) ? data.files : [];
        filteredRows = fallbackRows.filter((item) => {
          const value = String(item.userID || "");
          return userIdentifiers.includes(value);
        });
      }

      // Backend already returns wallet-aware rows (uploaded-by-user + current-wallet-owned),
      // so do not over-filter again on frontend.
      setMyFiles(filteredRows);
    } catch (error) {
      console.error(error);
      setStatusMessage(
        error?.message ||
          "Failed to load your files. Ensure backend is running on http://localhost:5000."
      );
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadMyFiles();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatusMessage("Uploading document to IPFS...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user?.email || userIdentifiers[0] || "Demo User");
      formData.append("userEmail", user?.email || "");
      formData.append("userName", user?.name || "");
      formData.append("walletAddress", connectedWalletAddress);

      const response = await fetch(`${API_BASE}/api/upload/handleupload`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok || !data?.result) {
        throw new Error(data?.message || "Upload failed");
      }

      setStatusMessage(
        "Upload successful. Request is now pending review by registrar/notary/local authority."
      );
      setFile(null);
      await loadMyFiles();
    } catch (error) {
      setStatusMessage(error?.message || "Failed to upload request");
    } finally {
      setUploading(false);
    }
  };

  const checkStatus = async (hash) => {
    try {
      const property = await getPropertyStateOnChain(hash);
      const verified = Number(property?.status || 0) === REGISTERED;
      setMyFiles((prev) =>
        prev.map((item) =>
          item.ipfshash === hash ? { ...item, verifiedOnChain: Boolean(verified) } : item
        )
      );
    } catch (error) {
      const message = String(error?.message || "");
      if (
        message.includes("CALL_EXCEPTION") ||
        message.includes("execution reverted") ||
        message.includes("require(false)")
      ) {
        setStatusMessage("Property is not available for on-chain verification yet.");
      } else {
        setStatusMessage(error?.message || "Failed to verify property");
      }
    }
  };

  const generateTransferCode = async () => {
    if (!connectedWalletAddress) {
      setStatusMessage("Connect wallet first to generate transfer code.");
      return;
    }

    try {
      setGeneratingCode(true);
      setStatusMessage("Generating temporary transfer code...");
      const response = await fetch(`${API_BASE}/api/transfer/generate-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: connectedWalletAddress }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to generate transfer code");
      }
      setGeneratedCode(data);
      setStatusMessage("Transfer code generated. Share this code with seller.");
    } catch (error) {
      setStatusMessage(error?.message || "Failed to generate transfer code");
    } finally {
      setGeneratingCode(false);
    }
  };

  const resolveTransferCode = async (hash) => {
    const code = String(transferCodeByHash[hash] || "")
      .trim()
      .toUpperCase();
    if (!code) {
      setStatusMessage("Enter transfer code first.");
      return;
    }

    try {
      setResolvingCodeHash(hash);
      setStatusMessage("Resolving transfer code...");
      const response = await fetch(
        `${API_BASE}/api/transfer/resolve/${encodeURIComponent(code)}`
      );
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to resolve transfer code");
      }
      if (!data?.walletAddress) {
        throw new Error("No wallet found for this transfer code.");
      }
      if (String(data.walletAddress).toLowerCase() === connectedWalletAddress) {
        throw new Error("You cannot transfer property to your own wallet.");
      }

      setResolvedBuyerByHash((prev) => ({
        ...prev,
        [hash]: {
          code,
          walletAddress: String(data.walletAddress).toLowerCase(),
          user: data.user || null,
          expiresAt: data.expiresAt || null,
        },
      }));
      setStatusMessage("Buyer resolved. You can transfer now.");
    } catch (error) {
      setResolvedBuyerByHash((prev) => {
        const next = { ...prev };
        delete next[hash];
        return next;
      });
      setStatusMessage(error?.message || "Failed to resolve transfer code");
    } finally {
      setResolvingCodeHash("");
    }
  };

  const handleTransfer = async (hash) => {
    const propertyHash = String(hash || "").trim();
    const enteredCode = String(transferCodeByHash[hash] || "")
      .trim()
      .toUpperCase();
    const resolvedBuyer = resolvedBuyerByHash[hash];
    if (!enteredCode) {
      setStatusMessage("Enter transfer code first.");
      return;
    }
    if (!resolvedBuyer || resolvedBuyer.code !== enteredCode) {
      setStatusMessage("Resolve transfer code first, then retry transfer.");
      return;
    }
    const newOwner = String(resolvedBuyer.walletAddress || "").trim().toLowerCase();

    try {
      const validationResponse = await fetch(`${API_BASE}/api/transfer/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hash: propertyHash,
          walletAddress: connectedWalletAddress,
        }),
      });
      const validationData = await parseJsonSafe(validationResponse);
      if (!validationResponse.ok) {
        throw new Error(validationData?.message || "Transfer validation failed");
      }

      const ownerOnChain = String(validationData?.property?.owner || "").toLowerCase();
      const statusOnChain = Number(validationData?.property?.status || 0);
      console.log("Blockchain owner:", ownerOnChain);
      console.log("Connected wallet:", connectedWalletAddress);
      console.log("Blockchain status:", statusOnChain);

      // Backend /api/transfer/validate is the source-of-truth guard.
      // Keep a defensive frontend check only when response is malformed.
      if (!ownerOnChain || statusOnChain !== REGISTERED) {
        setStatusMessage("Transfer validation failed. Refresh and try again.");
        return;
      }
      if (ownerOnChain !== connectedWalletAddress) {
        setStatusMessage(
          `Only property owner can transfer. Current on-chain owner is ${ownerOnChain}.`
        );
        return;
      }

      setTransferringHash(hash);
      setStatusMessage("Transferring property on blockchain...");
      await transferPropertyOnChain(propertyHash, newOwner);

      try {
        await fetch(`${API_BASE}/api/files/transfer-owner`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-role": "citizen" },
          body: JSON.stringify({
            hash: propertyHash,
            newOwnerWallet: newOwner,
            transferCode: enteredCode,
            role: "citizen",
          }),
        });
      } catch {
        // best effort; ownership UI can still be refreshed from chain sync
      }

      setMyFiles((prev) =>
        prev.map((item) =>
          item.ipfshash === hash
            ? {
                ...item,
                verified: false,
                verifiedOnChain: false,
                currentOwnerWallet: newOwner,
                transferCount: Number(item.transferCount || 0) + 1,
                lastTransferAt: new Date().toISOString(),
              }
            : item
        )
      );
      setTransferCodeByHash((prev) => ({ ...prev, [hash]: "" }));
      setResolvedBuyerByHash((prev) => {
        const next = { ...prev };
        delete next[hash];
        return next;
      });
      setStatusMessage("Transfer successful. Property is now unverified and requires re-approval.");
    } catch (error) {
      setStatusMessage(error?.message || "Property transfer failed");
    } finally {
      setTransferringHash("");
    }
  };

  const handlePushToBlockchain = async (item) => {
    const hash = String(item?.ipfshash || "").trim();
    if (!hash) return;
    if (!connectedWalletAddress) {
      setStatusMessage("Connect wallet first to push property on blockchain.");
      return;
    }
    if (Number(item?.approvalCount || 0) < 2) {
      setStatusMessage("At least 2 approvals are required before chain push.");
      return;
    }

    try {
      setPushingHash(hash);
      setStatusMessage("Waiting for MetaMask confirmation...");
      const result = await pushHashOnChainWithWallet(hash, connectedWalletAddress);
      const txHash = String(result?.transferTxHash || result?.registrationTxHash || "").trim();

      const response = await fetch(`${API_BASE}/api/files/confirm-chain-push`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-role": "citizen" },
        body: JSON.stringify({
          hash,
          role: "citizen",
          txHash: txHash || null,
        }),
      });
      const data = await parseJsonSafe(response);
      if (!response.ok) {
        throw new Error(data?.message || "Failed to confirm chain push");
      }

      setStatusMessage(
        `${data?.message || "Hash pushed on blockchain successfully."}${
          txHash ? ` Tx: ${txHash}` : ""
        }`
      );
      await loadMyFiles();
    } catch (error) {
      setStatusMessage(error?.message || "Blockchain push failed");
    } finally {
      setPushingHash("");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Citizen Dashboard</h1>
              <p className="text-sm text-slate-500">{user?.name || "Citizen"} | Upload & track property</p>
              <p className="mt-1 text-xs text-slate-600" title={connectedWalletAddress || ""}>
                Wallet: <span className="font-mono">{(connectedWalletAddress)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
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

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-xl transition hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-800">Upload Property Document</h2>
            <p className="mt-1 text-sm text-slate-500">Upload to IPFS and register hash on blockchain.</p>
            <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                Receive Property
              </p>
              <p className="mt-1 text-xs text-indigo-700">
                Generate one-time transfer code (valid for 10 minutes) and share with seller.
              </p>
              <button
                onClick={generateTransferCode}
                disabled={generatingCode}
                className={`mt-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                  generatingCode
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {generatingCode ? "Generating..." : "Generate Transfer Code"}
              </button>
              {generatedCode?.code && (
                <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2">
                  <p className="text-xs text-slate-700">
                    Code: <span className="font-mono font-semibold">{generatedCode.code}</span>
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Expires at:{" "}
                    {generatedCode.expiresAt
                      ? new Date(generatedCode.expiresAt).toLocaleString()
                      : "-"}
                  </p>
                </div>
              )}
            </div>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-xl ${
                !file || uploading
                  ? "cursor-not-allowed bg-slate-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading ? "Processing..." : "Upload & Register"}
            </button>
            {statusMessage && <p className="mt-3 text-sm text-slate-700">{statusMessage}</p>}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-xl transition hover:shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-800">My Document Status</h2>
            {loadingFiles ? (
              <p className="mt-3 text-sm text-slate-500">Loading...</p>
            ) : myFiles.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No uploaded documents.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {myFiles.map((item) => {
                  const isRejected = item.workflowStatus === "rejected";
                  const rejectionReasons = getRejectionReasons(item);

                  if (isRejected) {
                    return (
                      <div key={item._id} className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                        <p className="text-sm font-semibold text-rose-800">{item.filename}</p>
                        <p className="mt-1 text-xs text-rose-700">Status: Rejected</p>
                        {rejectionReasons.length === 0 ? (
                          <p className="mt-1 text-xs text-rose-700">Reason: Not provided</p>
                        ) : (
                          rejectionReasons.map((row, idx) => (
                            <p key={`${item._id}-reason-${idx}`} className="mt-1 text-xs text-rose-700">
                              Reason ({row.role}): {row.reason}
                            </p>
                          ))
                        )}
                      </div>
                    );
                  }

                  return (
                  <div key={item._id} className="rounded-xl border border-slate-200 p-3">
                    <p className="text-sm font-medium text-slate-800">{item.filename}</p>
                    <p className="mt-1 break-all font-mono text-xs text-slate-600">{item.ipfshash}</p>
                    <a
                      href={`https://gateway.pinata.cloud/ipfs/${item.ipfshash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-indigo-700 hover:underline"
                    >
                      View Document
                    </a>
                    {item.currentOwnerWallet && (
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-600">
                        Owner Wallet: {item.currentOwnerWallet}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs text-slate-600">
                        Status:{" "}
                        {item.workflowStatus === "rejected"
                          ? "Rejected"
                          : item.workflowStatus === "approved_pending_chain"
                          ? "Approved (Pending Chain Push)"
                          : item.workflowStatus === "approved" || item.verified || item.verifiedOnChain
                          ? "Verified"
                          : "Pending / Unverified"}
                      </span>
                      {!(item.verified || item.verifiedOnChain) &&
                        item.workflowStatus !== "rejected" &&
                        item.workflowStatus !== "pending" && (
                          <button
                            onClick={() => checkStatus(item.ipfshash)}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                          >
                            Check Status
                          </button>
                        )}
                    </div>
                    {Number(item.approvalCount || 0) >= 2 &&
                      item.workflowStatus === "approved_pending_chain" && (
                        <button
                          onClick={() => handlePushToBlockchain(item)}
                          disabled={pushingHash === item.ipfshash}
                          className={`mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                            pushingHash === item.ipfshash
                              ? "cursor-not-allowed bg-slate-400"
                              : "bg-emerald-600 hover:bg-emerald-700"
                          }`}
                        >
                          {pushingHash === item.ipfshash ? "Pushing..." : "Push on Blockchain"}
                        </button>
                      )}
                    {String(item.currentOwnerWallet || "").trim().toLowerCase() === connectedWalletAddress && (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={transferCodeByHash[item.ipfshash] || ""}
                          onChange={(e) => {
                            const nextCode = e.target.value.toUpperCase();
                            setTransferCodeByHash((prev) => ({
                              ...prev,
                              [item.ipfshash]: nextCode,
                            }));
                            setResolvedBuyerByHash((prev) => {
                              const next = { ...prev };
                              delete next[item.ipfshash];
                              return next;
                            });
                          }}
                          placeholder="Enter buyer transfer code"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-blue-500"
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <button
                            onClick={() => resolveTransferCode(item.ipfshash)}
                            disabled={resolvingCodeHash === item.ipfshash}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                              resolvingCodeHash === item.ipfshash
                                ? "cursor-not-allowed bg-slate-400"
                                : "bg-sky-600 hover:bg-sky-700"
                            }`}
                          >
                            {resolvingCodeHash === item.ipfshash ? "Resolving..." : "Resolve Code"}
                          </button>
                          <button
                            onClick={() => handleTransfer(item.ipfshash)}
                            disabled={transferringHash === item.ipfshash}
                            className={`rounded-lg px-3 py-2 text-xs font-semibold text-white ${
                              transferringHash === item.ipfshash
                                ? "cursor-not-allowed bg-slate-400"
                                : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                            title=""
                          >
                            {transferringHash === item.ipfshash ? "Transferring..." : "Transfer Property"}
                          </button>
                        </div>
                        {resolvedBuyerByHash[item.ipfshash] && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
                            <p className="text-xs font-semibold text-emerald-800">Buyer Details</p>
                            <p className="mt-1 break-all text-[11px] text-emerald-800">
                              Wallet:{" "}
                              <span className="font-mono">
                                {resolvedBuyerByHash[item.ipfshash].walletAddress}
                              </span>
                            </p>
                            <p className="text-[11px] text-emerald-800">
                              Name: {resolvedBuyerByHash[item.ipfshash].user?.name || "-"}
                            </p>
                            <p className="text-[11px] text-emerald-800">
                              Role: {resolvedBuyerByHash[item.ipfshash].user?.role || "-"}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )})}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CitizenDashboard;
