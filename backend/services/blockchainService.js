const { ethers } = require("ethers");

const RAW_CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY;
const CONTRACT_ADDRESS = (() => {
  const value = String(RAW_CONTRACT_ADDRESS || "").trim();
  if (!value) return "";
  if (!ethers.isAddress(value)) {
    throw new Error(
      `Invalid CONTRACT_ADDRESS format: "${value}". Expected 0x-prefixed 40-hex address.`
    );
  }
  return ethers.getAddress(value);
})();

const ABI = [
  "function requestRegistration(string ipfsHash)",
  "function registerProperty(string hash)",
  "function transferProperty(string hash, address newOwner)",
  "function approveProperty(string hash)",
  "function storeHash(string _hash)",
  "function getOwner(string hash) view returns (address)",
  "function verifyProperty(string hash) view returns (bool)",
  "function verifyHash(string _hash) view returns (bool)",
];

function hasSignerConfig() {
  return Boolean(CONTRACT_ADDRESS && PRIVATE_KEY);
}

function hasReadConfig() {
  return Boolean(CONTRACT_ADDRESS);
}

function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

async function getWriteContract() {
  if (!hasSignerConfig()) {
    throw new Error(
      "Blockchain signer config missing. Set CONTRACT_ADDRESS and BLOCKCHAIN_PRIVATE_KEY."
    );
  }

  const provider = getProvider();
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (!code || code === "0x") {
    throw new Error(`No contract deployed at ${CONTRACT_ADDRESS}`);
  }

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
}

async function getReadContract() {
  if (!hasReadConfig()) {
    throw new Error("Blockchain read config missing. Set CONTRACT_ADDRESS.");
  }

  const provider = getProvider();
  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (!code || code === "0x") {
    throw new Error(`No contract deployed at ${CONTRACT_ADDRESS}`);
  }

  return new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
}

async function storeHashOnChain(hash) {
  const contract = await getWriteContract();
  let tx;
  try {
    tx = await contract.requestRegistration(hash);
  } catch {
    try {
      tx = await contract.registerProperty(hash);
    } catch {
      tx = await contract.storeHash(hash);
    }
  }
  const receipt = await tx.wait();
  return { txHash: tx.hash, blockNumber: receipt?.blockNumber };
}

async function getOwnerOnChain(hash) {
  const contract = await getReadContract();
  try {
    return await contract.getOwner(hash);
  } catch {
    return ethers.ZeroAddress;
  }
}

async function getVerificationStatusOnChain(hash) {
  const contract = await getReadContract();
  try {
    return await contract.verifyProperty(hash);
  } catch {
    return await contract.verifyHash(hash);
  }
}

module.exports = {
  hasSignerConfig,
  hasReadConfig,
  storeHashOnChain,
  getOwnerOnChain,
  getVerificationStatusOnChain,
};
