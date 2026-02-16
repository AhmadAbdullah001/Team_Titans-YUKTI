import {
  ensureContractCode,
  ensureCorrectNetwork,
  ensureWalletConnected,
  getBrowserProvider,
  getWriteContract,
} from "./eth.js";

export default async function storeOnBlockchain(hash) {
  if (!hash) {
    throw new Error("Hash is required to store on-chain");
  }

  try {
    const provider = await getBrowserProvider();
    await ensureWalletConnected(provider);
    await ensureCorrectNetwork(provider);
    await ensureContractCode(provider);

    const signer = await provider.getSigner();
    const contract = getWriteContract(signer);

    // Avoid revert on duplicate hash registration.
    const exists = await contract.verifyHash(hash);
    if (exists) {
      return { alreadyRegistered: true };
    }

    const tx = await contract.storeHash(hash);
    const receipt = await tx.wait();

    return { txHash: tx.hash, blockNumber: receipt?.blockNumber };
  } catch (error) {
    const message = String(error?.reason || error?.message || "");
    if (message.toLowerCase().includes("already exists")) {
      return { alreadyRegistered: true };
    }
    throw new Error(
      error?.reason ||
        error?.message ||
        "Failed to store hash on blockchain"
    );
  }
}
