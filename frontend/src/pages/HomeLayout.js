import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Home from "../components/Home.js";
import FilesPage from "../components/FilesPage.js";

function getStoredUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function HomeLayout() {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("upload");
  const user = useMemo(() => getStoredUser(), []);
  const role = localStorage.getItem("role") || "guest";
  const canViewFiles = role === "citizen" || role === "registrar";

  const logout = () => {
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">eVault</h1>
          <p className="text-sm text-slate-500">
            {user?.name || "User"} ({role})
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white p-1 shadow-sm">
          <button
            onClick={() => setActivePage("upload")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activePage === "upload"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Home
          </button>
          {canViewFiles && (
            <button
              onClick={() => setActivePage("files")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activePage === "files"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Files
            </button>
          )}
          <button
            onClick={logout}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="pt-2">{activePage === "files" ? <FilesPage /> : <Home />}</div>
    </div>
  );
}

export default HomeLayout;
