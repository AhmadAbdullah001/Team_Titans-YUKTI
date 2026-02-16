import { Interface } from "ethers";
import { ethers } from "ethers";
import {
  ensureContractCode,
  ensureCorrectNetwork,
  ensureWalletConnected,
  getBrowserProvider,
  getContractRuntimeConfig,
  getReadOnlyContract,
  getWriteContract,
} from "./eth.js";

async function getWriteReadyContract() {
  const provider = await getBrowserProvider();
  await ensureWalletConnected(provider);
  await ensureCorrectNetwork(provider);
  await ensureContractCode(provider);
  const signer = await provider.getSigner();
  const contract = getWriteContract(signer);
  const signerAddress = await signer.getAddress();
  return { contract, signerAddress };
}

async function getReadReadyContract() {
  const provider = await getBrowserProvider();
  await ensureWalletConnected(provider);
  await ensureCorrectNetwork(provider);
  await ensureContractCode(provider);
  return getReadOnlyContract(provider);
}

async function findEVaultPropertiesByHash(hash) {
  const normalizedHash = String(hash || "").trim();
  if (!normalizedHash) return [];

  const provider = await getBrowserProvider();
  await ensureWalletConnected(provider);
  await ensureCorrectNetwork(provider);
  await ensureContractCode(provider);
  const { contractAddress } = getContractRuntimeConfig();

  const evaultReader = new ethers.Contract(
    contractAddress,
    [
      "function hashToPropertyId(string) view returns (uint256)",
      "function getProperty(uint256) view returns (uint256 id,address owner,string ipfsHash,bool registrarApproved,bool notaryApproved,bool authorityApproved,uint256 approvalCount,uint8 status,bool bankVerified)",
      "function propertyCounter() view returns (uint256)",
      "function properties(uint256) view returns (uint256 id,address owner,string ipfsHash,bool registrarApproved,bool notaryApproved,bool authorityApproved,uint256 approvalCount,uint8 status,bool bankVerified)",
    ],
    provider
  );

  // Preferred path: resolve id directly from hash mapping.
  try {
    const propertyId = Number(await evaultReader.hashToPropertyId(normalizedHash));
    if (propertyId > 0) {
      let row;
      try {
        row = await evaultReader.getProperty(propertyId);
      } catch {
        row = await evaultReader.properties(propertyId);
      }
      return [
        {
          id: Number(row.id || propertyId),
          owner: String(row.owner || ""),
          ipfsHash: String(row.ipfsHash || normalizedHash),
          status: Number(row.status || 0),
          approvalCount: Number(row.approvalCount || 0),
        },
      ];
    }
  } catch {
    // fallback scan below
  }

  let count = 0;
  try {
    count = Number(await evaultReader.propertyCounter());
  } catch {
    return [];
  }

  const matches = [];
  for (let i = 1; i <= count; i += 1) {
    try {
      const row = await evaultReader.properties(i);
      const rowHash = String(row?.ipfsHash || "").trim();
      if (rowHash && rowHash === normalizedHash) {
        matches.push({
          id: Number(row.id || i),
          owner: String(row.owner || ""),
          ipfsHash: rowHash,
          status: Number(row.status || 0),
          approvalCount: Number(row.approvalCount || 0),
        });
      }
    } catch {
      // continue scan
    }
  }

  return matches;
}

async function findEVaultPropertyByHash(hash, preferredOwner = "") {
  const matches = await findEVaultPropertiesByHash(hash);
  if (!matches.length) return null;

  const normalizedPreferredOwner = String(preferredOwner || "").trim().toLowerCase();
  if (normalizedPreferredOwner) {
    const owned = matches
      .filter((m) => String(m.owner || "").toLowerCase() === normalizedPreferredOwner)
      .sort((a, b) => b.id - a.id);
    if (owned.length) return owned[0];
  }

  // Prefer latest registered record; otherwise latest id.
  const registered = matches
    .filter((m) => Number(m.status) === 2)
    .sort((a, b) => b.id - a.id);
  if (registered.length) return registered[0];

  return matches.sort((a, b) => b.id - a.id)[0];
}

export async function getPropertyStateOnChain(hash, preferredOwner = "") {
  const normalizedHash = String(hash || "").trim();
  const property = await findEVaultPropertyByHash(normalizedHash, preferredOwner);
  if (property) {
    return property;
  }

  const contract = await getReadReadyContract();
  let owner = ethers.ZeroAddress;
  try {
    owner = await contract.getOwner(normalizedHash);
  } catch {
    try {
      owner = await contract.documentOwner(normalizedHash);
    } catch {
      owner = ethers.ZeroAddress;
    }
  }

  let verified = false;
  try {
    verified = await contract.verifyProperty(normalizedHash);
  } catch {
    try {
      verified = await contract.verifyHash(normalizedHash);
    } catch {
      verified = false;
    }
  }

  if (owner && String(owner).toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    return {
      id: 0,
      owner: String(owner),
      ipfsHash: normalizedHash,
      status: verified ? 2 : 0,
      approvalCount: 0,
    };
  }

  throw new Error("Property hash was not found on-chain.");
}

export async function registerPropertyOnChain(hash) {
  const { contract, signerAddress } = await getWriteReadyContract();

  const isRegistrar = await contract.registrars(signerAddress);
  if (isRegistrar) {
    throw new Error(
      `Connected wallet ${signerAddress} is registered as registrar on-chain. Switch to a non-registrar wallet to upload as citizen.`
    );
  }

  try {
    const exists = await contract.verifyHash(hash);
    if (exists) {
      return "already-registered";
    }
  } catch {
    // continue and try write path
  }

  try {
    const tx = await contract.registerProperty(hash);
    await tx.wait();
    return tx.hash;
  } catch (error) {
    const message = String(error?.reason || error?.shortMessage || error?.message || "");
    if (message.toLowerCase().includes("already exists")) {
      return "already-registered";
    }
    if (message.includes("is not a function") || message.includes("missing revert data")) {
      const tx = await contract.storeHash(hash);
      await tx.wait();
      return tx.hash;
    }
    throw error;
  }
}

export async function pushHashOnChainWithWallet(hash, intendedOwner = "") {
  const provider = await getBrowserProvider();
  await ensureWalletConnected(provider);
  await ensureCorrectNetwork(provider);
  await ensureContractCode(provider);
  const signer = await provider.getSigner();
  const signerAddress = String(await signer.getAddress()).toLowerCase();
  const { contractAddress } = getContractRuntimeConfig();
  const normalizedHash = String(hash || "").trim();
  const normalizedIntendedOwner = String(intendedOwner || "").trim().toLowerCase();
  if (!normalizedHash) {
    throw new Error("Property hash is required");
  }

  const attempts = [
    "function requestRegistration(string ipfsHash)",
    "function registerProperty(string hash)",
    "function storeHash(string _hash)",
  ];

  let lastError = null;
  let registrationTxHash = "";
  for (const fragment of attempts) {
    try {
      const iface = new Interface([fragment]);
      const fn = String(fragment.match(/function\s+([^(]+)/)?.[1] || "").trim();
      const data = iface.encodeFunctionData(fn, [normalizedHash]);
      const tx = await signer.sendTransaction({ to: contractAddress, data });
      await tx.wait();
      registrationTxHash = tx.hash;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!registrationTxHash) {
    throw new Error(
      `Wallet chain push failed: ${String(
        lastError?.reason || lastError?.shortMessage || lastError?.message || "unknown error"
      )}`
    );
  }

  // If reviewer wallet pushed the hash, transfer ownership to intended owner immediately.
  if (
    normalizedIntendedOwner &&
    ethers.isAddress(normalizedIntendedOwner) &&
    normalizedIntendedOwner !== signerAddress
  ) {
    let transferError = null;
    // Preferred eVault path: use propertyId resolved by hash mapping.
    try {
      const property = await getPropertyStateOnChain(normalizedHash, signerAddress);
      if (property?.id) {
        const iface = new Interface([
          "function transferProperty(uint256 propertyId, address newOwner)",
        ]);
        const data = iface.encodeFunctionData("transferProperty", [
          property.id,
          normalizedIntendedOwner,
        ]);
        const tx = await signer.sendTransaction({ to: contractAddress, data });
        await tx.wait();
        return { registrationTxHash, transferTxHash: tx.hash };
      }
    } catch (error) {
      transferError = error;
    }

    try {
      const iface = new Interface([
        "function transferProperty(string hash, address newOwner)",
      ]);
      const data = iface.encodeFunctionData("transferProperty", [
        normalizedHash,
        normalizedIntendedOwner,
      ]);
      const tx = await signer.sendTransaction({ to: contractAddress, data });
      await tx.wait();
      return { registrationTxHash, transferTxHash: tx.hash };
    } catch (error) {
      transferError = error;
    }

    // eVault fallback: transferProperty(uint256,address)
    try {
      const property = await findEVaultPropertyByHash(normalizedHash, signerAddress);
      if (property?.id) {
        const iface = new Interface([
          "function transferProperty(uint256 propertyId, address newOwner)",
        ]);
        const data = iface.encodeFunctionData("transferProperty", [
          property.id,
          normalizedIntendedOwner,
        ]);
        const tx = await signer.sendTransaction({ to: contractAddress, data });
        await tx.wait();
        return { registrationTxHash, transferTxHash: tx.hash };
      }
    } catch (fallbackError) {
      transferError = fallbackError;
    }

    throw new Error(
      `Hash pushed, but owner transfer to intended wallet failed: ${String(
        transferError?.reason ||
          transferError?.shortMessage ||
          transferError?.message ||
          "unknown error"
      )}`
    );
  }

  return { registrationTxHash, transferTxHash: "" };
}

export async function approvePropertyOnChain(hash) {
  const { contract, signerAddress } = await getWriteReadyContract();

  const isRegistrar = await contract.registrars(signerAddress);
  if (!isRegistrar) {
    throw new Error(
      `Connected wallet ${signerAddress} is not on-chain registrar. Ask admin to call addRegistrar.`
    );
  }

  const tx = await contract.approveProperty(hash);
  await tx.wait();
  return tx.hash;
}

export async function verifyPropertyOnChain(hash) {
  const contract = await getReadReadyContract();
  try {
    return await contract.verifyProperty(hash);
  } catch {
    try {
      return await contract.verifyHash(hash);
    } catch {
      return false;
    }
  }
}

export async function propertyExistsOnChain(hash) {
  const contract = await getReadReadyContract();
  try {
    return await contract.verifyHash(hash);
  } catch {
    try {
      const owner = await contract.getOwner(hash);
      return owner && owner !== "0x0000000000000000000000000000000000000000";
    } catch {
      return null;
    }
  }
}

export async function getPropertyOwnerOnChain(hash) {
  const contract = await getReadReadyContract();
  try {
    return await contract.getOwner(hash);
  } catch {
    try {
      return await contract.documentOwner(hash);
    } catch {
      const property = await findEVaultPropertyByHash(hash);
      return property?.owner || "0x0000000000000000000000000000000000000000";
    }
  }
}

export async function transferPropertyOnChain(hash, newOwner) {
  const { contract, signerAddress } = await getWriteReadyContract();
  const normalizedHash = String(hash || "").trim();
  const normalizedOwner = String(newOwner || "").trim();

  if (!normalizedHash) {
    throw new Error("Property hash is required");
  }
  if (!normalizedOwner) {
    throw new Error("New owner wallet address is required");
  }

  // Preferred eVault path: resolve propertyId from hash and transfer by id.
  try {
    const property = await getPropertyStateOnChain(normalizedHash, signerAddress);
    if (!property?.id) {
      throw new Error("Property hash not found in eVault contract.");
    }
    const iface = new Interface([
      "function transferProperty(uint256 propertyId, address newOwner)",
    ]);
    const data = iface.encodeFunctionData("transferProperty", [
      property.id,
      normalizedOwner,
    ]);
    const tx = await contract.runner.sendTransaction({
      to: contract.target,
      data,
    });
    await tx.wait();
    return { txHash: tx.hash, from: signerAddress, to: normalizedOwner };
  } catch (fallbackError) {
    // Legacy fallback: contracts that transfer by hash.
    try {
      const tx = await contract.transferProperty(normalizedHash, normalizedOwner);
      await tx.wait();
      return { txHash: tx.hash, from: signerAddress, to: normalizedOwner };
    } catch (error) {
      const fallbackMessage = String(
        fallbackError?.reason ||
          fallbackError?.shortMessage ||
          fallbackError?.message ||
          ""
      );
      if (fallbackMessage.includes("Only current owner")) {
        throw new Error("Connected wallet is not the current on-chain owner of this property.");
      }
      if (fallbackMessage.includes("Invalid owner") || fallbackMessage.includes("Invalid new owner")) {
        throw new Error("Invalid recipient wallet address.");
      }
      if (fallbackMessage.includes("Property hash not found in eVault contract")) {
        throw new Error("Property hash was not found on-chain.");
      }
      const message = String(error?.reason || error?.shortMessage || error?.message || "");
      if (message.includes("Property not found")) {
        throw new Error(
          "Property hash not found on the current blockchain. Register this hash on-chain before transfer."
        );
      }
      if (message.includes("Only current owner")) {
        throw new Error("Connected wallet is not the current on-chain owner of this property.");
      }
      if (message.includes("Invalid new owner")) {
        throw new Error("Invalid recipient wallet address.");
      }
      if (message.includes("Already owner")) {
        throw new Error("Recipient wallet is already the current owner.");
      }
      if (
        message.includes("CALL_EXCEPTION") ||
        message.includes("execution reverted") ||
        message.includes("require(false)")
      ) {
        throw new Error("Transfer failed due to contract function mismatch or missing on-chain property.");
      }
      throw error;
    }
  }
}

export async function getPropertyHistoryOnChain(hash) {
  const contract = await getReadReadyContract();
  const records = await contract.getPropertyHistory(hash);
  return (records || []).map((r) => ({
    from: r.from,
    to: r.to,
    timestamp: Number(r.timestamp),
  }));
}

export async function getAllPropertiesOnChain() {
  const contract = await getReadReadyContract();
  return await contract.getAllProperties();
}

export async function getWalletRoleOnChain() {
  const { contract, signerAddress } = await getWriteReadyContract();
  const [isRegistrar, adminAddress] = await Promise.all([
    contract.registrars(signerAddress),
    contract.admin(),
  ]);

  return {
    wallet: signerAddress,
    isRegistrar: Boolean(isRegistrar),
    adminAddress,
    isAdmin: String(adminAddress).toLowerCase() === String(signerAddress).toLowerCase(),
  };
}

export async function grantRegistrarOnChain(registrarAddress) {
  const { contract } = await getWriteReadyContract();
  const tx = await contract.addRegistrar(registrarAddress);
  await tx.wait();
  return tx.hash;
}

export async function revokeRegistrarOnChain(registrarAddress) {
  const normalized = String(registrarAddress || "").trim();
  if (!normalized) {
    throw new Error("Registrar wallet address is required");
  }

  const { contract } = await getWriteReadyContract();
  const iface = new Interface(["function removeRegistrar(address registrar)"]);
  const data = iface.encodeFunctionData("removeRegistrar", [normalized]);

  const tx = await contract.runner.sendTransaction({
    to: contract.target,
    data,
  });
  await tx.wait();
  return tx.hash;
}

export async function isWalletRegistrarOnChain(walletAddress) {
  const normalized = String(walletAddress || "").trim();
  if (!normalized) return false;
  const contract = await getReadReadyContract();
  return Boolean(await contract.registrars(normalized));
}

export async function getAdminAddressOnChain() {
  const contract = await getReadReadyContract();
  return await contract.admin();
}

export async function getRegistrarStatusOnChain(walletAddress) {
  return await isWalletRegistrarOnChain(walletAddress);
}
