import React from "react";

function AdminPanel({
  walletInfo,
  grantAddress,
  setGrantAddress,
  grantRegistrar,
  revokeRegistrar,
  granting,
  revoking,
  loadingRegistrars,
  registrarUsers,
  setActionMessage,
  adminAddress,
}) {
  if (!walletInfo?.isAdmin) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={grantAddress}
          onChange={(e) => setGrantAddress(e.target.value)}
          placeholder="Registrar wallet address"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => grantRegistrar()}
          disabled={granting}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
            granting ? "cursor-not-allowed bg-slate-400" : "bg-indigo-600 hover:bg-indigo-700"
          }`}
        >
          {granting ? "Granting..." : "Grant Registrar Role"}
        </button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2">
        <p className="mb-2 text-[11px] font-semibold uppercase text-slate-600">
          Registrar Wallet Status
        </p>
        {loadingRegistrars ? (
          <p className="text-[11px] text-slate-500">Loading registrar users...</p>
        ) : registrarUsers.length === 0 ? (
          <p className="text-[11px] text-slate-500">No registrar users found in MongoDB.</p>
        ) : (
          <div className="space-y-2">
            {registrarUsers.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 rounded-md border border-slate-200 p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-xs font-medium text-slate-800">{item.name}</p>
                  <p className="text-[11px] text-slate-600">Employee ID: {item.employeeId || "-"}</p>
                  <p className="break-all font-mono text-[11px] text-slate-600">
                    {item.walletAddress || "No wallet saved"}
                  </p>
                  <p className="text-[11px] text-slate-700">
                    Registrar: {item.isRegistrarOnChain ? "Yes" : "No"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!item.walletAddress) {
                        setActionMessage("Registrar wallet address missing in MongoDB.");
                        return;
                      }
                      grantRegistrar(item.walletAddress);
                    }}
                    disabled={granting || !item.walletAddress || item.isRegistrarOnChain}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                      granting || !item.walletAddress || item.isRegistrarOnChain
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {item.isRegistrarOnChain ? "On-Chain Added" : "Grant Registrar Role"}
                  </button>
                  <button
                    onClick={() => {
                      if (!item.walletAddress) {
                        setActionMessage("Registrar wallet address missing in MongoDB.");
                        return;
                      }
                      revokeRegistrar(item.walletAddress);
                    }}
                    disabled={
                      revoking ||
                      !item.walletAddress ||
                      !item.isRegistrarOnChain ||
                      String(item.walletAddress).toLowerCase() === String(adminAddress || "").toLowerCase()
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${
                      revoking ||
                      !item.walletAddress ||
                      !item.isRegistrarOnChain ||
                      String(item.walletAddress).toLowerCase() === String(adminAddress || "").toLowerCase()
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-rose-600 hover:bg-rose-700"
                    }`}
                  >
                    {revoking ? "Revoking..." : "Revoke Registrar Role"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPanel;
