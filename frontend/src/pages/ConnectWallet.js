import React, { useEffect, useState } from "react";
import WalletStatus from "../components/WalletStatus.js";
import { EVAULT_ADDRESS } from "../utils/config.js";
import { getSavedWallet } from "../utils/web3.js";

function ConnectWallet() {
  const [wallet, setWallet] = useState(null);

  useEffect(() => {
    setWallet(getSavedWallet());
  }, []);

  return (
    <div className="page-grid">
      <WalletStatus />
      <section className="card">
        <h2>Contract</h2>
        <p>eVault Address: {EVAULT_ADDRESS}</p>
        <p>Connected Address: {wallet?.address || "-"}</p>
      </section>
      <section className="card">
        <h2>Usage Flow</h2>
        <p>1. Connect MetaMask.</p>
        <p>2. Upload title document in Register Property.</p>
        <p>3. Approve by registrar, notary, and local authority.</p>
        <p>4. Track status, bank verification, timeline, and transfers.</p>
      </section>
    </div>
  );
}

export default ConnectWallet;
