import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  getAllPropertiesOnChain,
  getPropertyHistoryOnChain,
  getPropertyOwnerOnChain,
  verifyPropertyOnChain,
} from "../contract/propertyActions.js";

function PropertyExplorer() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const hashes = await getAllPropertiesOnChain();
        const details = await Promise.all(
          (hashes || []).map(async (hash) => {
            try {
              const [owner, verified, history] = await Promise.all([
                getPropertyOwnerOnChain(hash),
                verifyPropertyOnChain(hash),
                getPropertyHistoryOnChain(hash),
              ]);
              return { hash, owner, verified: Boolean(verified), history: history || [] };
            } catch {
              return { hash, owner: "-", verified: false, history: [] };
            }
          })
        );
        setRows(details);
      } catch (e) {
        setError(e?.message || "Failed to load properties from blockchain.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Property Explorer</h1>
              <p className="text-sm text-slate-500">On-chain property listing and ownership history.</p>
            </div>
            <Link
              to="/home"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="rounded-xl bg-white p-6 shadow-xl">
          {loading ? (
            <p className="text-sm text-slate-500">Loading properties from blockchain...</p>
          ) : error ? (
            <p className="text-sm text-rose-700">{error}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-slate-500">No properties registered on-chain yet.</p>
          ) : (
            <div className="space-y-4">
              {rows.map((row) => (
                <div key={row.hash} className="rounded-xl border border-slate-200 p-4">
                  <p className="break-all font-mono text-xs text-slate-700">{row.hash}</p>
                  <p className="mt-1 break-all text-sm text-slate-700">
                    Owner: <span className="font-mono text-xs">{row.owner}</span>
                  </p>
                  <a
                    href={`https://gateway.pinata.cloud/ipfs/${row.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs font-semibold text-indigo-700 hover:underline"
                  >
                    View Document
                  </a>
                  <p className="mt-1 text-sm text-slate-700">
                    Verified:{" "}
                    <span className={row.verified ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                      {row.verified ? "Yes" : "No"}
                    </span>
                  </p>
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-slate-700">Transfer History</p>
                    {row.history.length === 0 ? (
                      <p className="text-xs text-slate-500">No transfer records.</p>
                    ) : (
                      <div className="mt-1 space-y-1">
                        {row.history.map((record, index) => (
                          <p key={`${row.hash}-${index}`} className="break-all font-mono text-[11px] text-slate-600">
                            {record.from} -> {record.to} at{" "}
                            {record.timestamp ? new Date(record.timestamp * 1000).toLocaleString() : "-"}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default PropertyExplorer;
