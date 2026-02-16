import React, { useEffect, useState } from "react";
import { connectWallet, getSavedWallet, shortAddress } from "../utils/web3.js";

function WalletStatus() {
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = getSavedWallet();
    if (saved?.address) {
      setAddress(saved.address);
      setChainId(saved.chainId || "");
    }
  }, []);

  const handleConnect = async () => {
    try {
      setMessage("Connecting wallet...");
      const wallet = await connectWallet();
      setAddress(wallet.address);
      setChainId(wallet.chainId);
      setMessage("Wallet connected.");
    } catch (error) {
      setMessage(error.message || "Failed to connect wallet.");
    }
  };

  return (
    <section className="card">
      <h2>Wallet</h2>
      <p>Address: {address ? shortAddress(address) : "Not connected"}</p>
      <p>Chain ID: {chainId || "-"}</p>
      <button onClick={handleConnect}>Connect Wallet</button>
      {message ? <p className="message">{message}</p> : null}
    </section>
  );
}

export default WalletStatus;
