import React, { useEffect, useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { getAllProperties, verifyByBank } from "../utils/evault.js";
import PropertyStatusBadge from "../components/PropertyStatusBadge.js";

function PropertyDashboard() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadProperties = async () => {
    try {
      setLoading(true);
      const rows = await getAllProperties();
      setProperties(rows);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, []);

  const handleBankVerify = async (propertyId) => {
    try {
      setLoading(true);
      const txHash = await verifyByBank(propertyId);
      await loadProperties();
      setMessage(`Bank verification submitted. Tx: ${txHash}`);
    } catch (error) {
      setMessage(error.message || "Bank verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Property Dashboard</h2>
        <button onClick={loadProperties} disabled={loading}>
          {loading ? "Loading..." : "Refresh Properties"}
        </button>
        {message ? <p className="message">{message}</p> : null}
        {properties.length === 0 ? (
          <p>No properties found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Owner</th>
                  <th>IPFS</th>
                  <th>Status</th>
                  <th>Bank Verified</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id}>
                    <td>{property.id}</td>
                    <td>{property.owner}</td>
                    <td>{property.ipfsHash}</td>
                    <td>
                      <PropertyStatusBadge status={property.status} />
                    </td>
                    <td>{property.bankVerified ? "Verified" : "Pending"}</td>
                    <td>
                      <button
                        onClick={() => handleBankVerify(property.id)}
                        disabled={loading || property.bankVerified}
                      >
                        Verify by Bank
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default PropertyDashboard;
