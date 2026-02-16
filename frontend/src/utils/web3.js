import { ethers } from "ethers";
import { EVAULT_ADDRESS } from "./config.js";
import { EVAULT_ABI } from "./evaultAbi.js";

const WALLET_KEY = "evault_wallet";

function ensureWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is required.");
  }
}

export async function connectWallet() {
  ensureWallet();
  const provider = new ethers.BrowserProvider(window.ethereum);
  const accounts = await provider.send("eth_requestAccounts", []);
  const network = await provider.getNetwork();
  const wallet = {
    address: accounts[0],
    chainId: network.chainId.toString(),
  };
  localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
  return wallet;
}

export function getSavedWallet() {
  try {
    return JSON.parse(localStorage.getItem(WALLET_KEY) || "null");
  } catch {
    return null;
  }
}

export async function getProvider() {
  ensureWallet();
  return new ethers.BrowserProvider(window.ethereum);
}

export async function getSigner() {
  const provider = await getProvider();
  return provider.getSigner();
}

export async function getEVaultContract(withSigner = false) {
  if (!EVAULT_ADDRESS || EVAULT_ADDRESS === ethers.ZeroAddress) {
    throw new Error("Set REACT_APP_EVAULT_ADDRESS in frontend/.env");
  }
  if (withSigner) {
    const signer = await getSigner();
    return new ethers.Contract(EVAULT_ADDRESS, EVAULT_ABI, signer);
  }
  const provider = await getProvider();
  return new ethers.Contract(EVAULT_ADDRESS, EVAULT_ABI, provider);
}

export function shortAddress(address) {
  if (!address) return "";
  const v = String(address);
  return `${v.slice(0, 6)}...${v.slice(-4)}`;
}
