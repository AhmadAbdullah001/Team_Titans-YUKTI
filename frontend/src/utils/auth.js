const VALID_ROLES = new Set(["citizen", "registrar", "notary", "localAuthority"]);

export function getStoredRole() {
  const role = localStorage.getItem("role");
  return VALID_ROLES.has(role) ? role : null;
}

export function getHomePathForRole(role) {
  if (role === "citizen") return "/citizen";
  if (role === "registrar") return "/registrar";
  if (role === "notary") return "/notary";
  if (role === "localAuthority") return "/local-authority";
  return "/login";
}
