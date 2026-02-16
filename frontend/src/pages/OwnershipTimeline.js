import React, { useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { getOwnershipHistory } from "../utils/evault.js";

function OwnershipTimeline() {
  const [propertyId, setPropertyId] = useState("");
  const [records, setRecords] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLoadHistory = async () => {
    try {
      if (!propertyId) {
        setMessage("Enter property ID.");
        return;
      }
      setLoading(true);
      const history = await getOwnershipHistory(Number(propertyId));
      setRecords(history);
      setMessage("");
    } catch (error) {
      setRecords([]);
      setMessage(error.message || "Failed to load ownership history.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Ownership Timeline</h2>
        <input
          type="number"
          min="1"
          placeholder="Property ID"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        />
        <button onClick={handleLoadHistory} disabled={loading}>
          {loading ? "Loading..." : "Load Timeline"}
        </button>
        {message ? <p className="message">{message}</p> : null}
        {records.length > 0 ? (
          <ol className="timeline">
            {records.map((record, index) => (
              <li key={`${record.owner}-${record.timestamp}-${index}`}>
                <p>
                  Owner: <code>{record.owner}</code>
                </p>
                <p>Timestamp: {record.readableTime}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>No records found for this property.</p>
        )}
      </section>
    </div>
  );
}

export default OwnershipTimeline;
