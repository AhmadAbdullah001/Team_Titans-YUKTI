import React from "react";
import { statusLabel } from "../utils/evault.js";

function PropertyStatusBadge({ status }) {
  const label = statusLabel(status);
  const className =
    label === "Registered"
      ? "badge badge-green"
      : label === "Rejected"
      ? "badge badge-red"
      : "badge badge-yellow";

  return <span className={className}>{label}</span>;
}

export default PropertyStatusBadge;
