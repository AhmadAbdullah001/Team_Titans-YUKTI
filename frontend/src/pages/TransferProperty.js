import React, { useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { isValidAddress, transferProperty } from "../utils/evault.js";

function TransferProperty() {
  const [propertyId, setPropertyId] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTransfer = async () => {
    try {
      if (!propertyId) {
        setMessage("Enter property ID.");
        return;
      }
      if (!isValidAddress(newOwner)) {
        setMessage("Enter a valid new owner wallet address.");
        return;
      }

      setLoading(true);
      const txHash = await transferProperty(Number(propertyId), newOwner);
      setMessage(`Property transferred. Tx: ${txHash}`);
    } catch (error) {
      setMessage(error.message || "Transfer failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Transfer Property</h2>
        <p>Only current owner wallet can execute transfer.</p>
        <input
          type="number"
          min="1"
          placeholder="Property ID"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        />
        <input
          type="text"
          placeholder="New owner address"
          value={newOwner}
          onChange={(e) => setNewOwner(e.target.value)}
        />
        <button onClick={handleTransfer} disabled={loading}>
          {loading ? "Transferring..." : "Transfer"}
        </button>
        {message ? <p className="message">{message}</p> : null}
      </section>
    </div>
  );
}

export default TransferProperty;
