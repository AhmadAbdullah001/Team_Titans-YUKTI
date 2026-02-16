import React from "react";
import { NavLink } from "react-router-dom";

const links = [
  { to: "/connect", label: "Connect Wallet" },
  { to: "/register", label: "Register Property" },
  { to: "/approvals", label: "Approval Dashboard" },
  { to: "/properties", label: "Property Dashboard" },
  { to: "/timeline", label: "Ownership Timeline" },
  { to: "/transfer", label: "Transfer Property" },
];

function NavLayout({ children }) {
  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>eVault - Decentralized Property Title Registry</h1>
        <nav className="top-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="page-body">{children}</main>
    </div>
  );
}

export default NavLayout;
