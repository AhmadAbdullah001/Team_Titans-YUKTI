import React, { useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { uploadDocumentToIPFS } from "../utils/ipfs.js";
import { requestRegistration } from "../utils/evault.js";

function RegisterProperty() {
  const [file, setFile] = useState(null);
  const [ipfsHash, setIpfsHash] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!file) {
      setMessage("Choose a document first.");
      return;
    }

    try {
      setLoading(true);
      setMessage("Uploading to IPFS...");
      const hash = await uploadDocumentToIPFS(file);
      setIpfsHash(hash);

      setMessage("Submitting property registration...");
      const txHash = await requestRegistration(hash);
      setMessage(`Property requested. Tx: ${txHash}`);
    } catch (error) {
      setMessage(error.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Register Property</h2>
        <p>Upload document to IPFS and call requestRegistration.</p>
        <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button onClick={handleRegister} disabled={loading}>
          {loading ? "Processing..." : "Upload & Request Registration"}
        </button>
        {ipfsHash ? (
          <p>
            IPFS Hash: <code>{ipfsHash}</code>
          </p>
        ) : null}
        {message ? <p className="message">{message}</p> : null}
      </section>
    </div>
  );
}

export default RegisterProperty;
