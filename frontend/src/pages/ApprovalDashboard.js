import React, { useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { approveProperty, getProperty } from "../utils/evault.js";
import PropertyStatusBadge from "../components/PropertyStatusBadge.js";

function ApprovalDashboard() {
  const [propertyId, setPropertyId] = useState("");
  const [property, setProperty] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadProperty = async () => {
    try {
      if (!propertyId) return;
      setLoading(true);
      const data = await getProperty(Number(propertyId));
      setProperty(data);
      setMessage("");
    } catch (error) {
      setProperty(null);
      setMessage(error.message || "Failed to read property.");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (roleName) => {
    try {
      if (!propertyId) {
        setMessage("Enter property ID.");
        return;
      }
      setLoading(true);
      const txHash = await approveProperty(Number(propertyId));
      await loadProperty();
      setMessage(`${roleName} approval submitted. Tx: ${txHash}`);
    } catch (error) {
      setMessage(error.message || "Approval failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Approval Dashboard</h2>
        <p>Use role wallet (registrar, notary, local authority) to approve once each.</p>
        <input
          type="number"
          min="1"
          placeholder="Property ID"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        />
        <div className="button-row">
          <button onClick={loadProperty} disabled={loading}>
            Refresh Property
          </button>
          <button onClick={() => handleApprove("Registrar")} disabled={loading}>
            Registrar Approve
          </button>
          <button onClick={() => handleApprove("Notary")} disabled={loading}>
            Notary Approve
          </button>
          <button onClick={() => handleApprove("Authority")} disabled={loading}>
            Authority Approve
          </button>
        </div>
        {property ? (
          <div className="panel">
            <p>ID: {property.id}</p>
            <p>
              Status: <PropertyStatusBadge status={property.status} />
            </p>
            <p>Approval Count: {property.approvalCount}</p>
            <p>Registrar Approved: {property.registrarApproved ? "Yes" : "No"}</p>
            <p>Notary Approved: {property.notaryApproved ? "Yes" : "No"}</p>
            <p>Authority Approved: {property.authorityApproved ? "Yes" : "No"}</p>
          </div>
        ) : null}
        {message ? <p className="message">{message}</p> : null}
      </section>
    </div>
  );
}

export default ApprovalDashboard;
