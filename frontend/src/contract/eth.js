import { ethers } from "ethers";
import abi from "./abi.json";
import {
  HARDHAT_LOCALHOST_CHAIN_ID,
  contractAddress,
  LAND_REGISTRY_VERSION,
} from "./contractconfig.js";

const LOCAL_RPC_URL = "http://127.0.0.1:8545";
let isContractCodeValidated = false;

export function getLocalReadProvider() {
  return new ethers.JsonRpcProvider(LOCAL_RPC_URL);
}

export async function getBrowserProvider() {
  if (!window.ethereum) {
    throw new Error("MetaMask not installed");
  }
  return new ethers.BrowserProvider(window.ethereum);
}

export async function ensureWalletConnected(provider) {
  const accounts = await provider.send("eth_accounts", []);
  if (accounts && accounts.length > 0) {
    return accounts;
  }

  try {
    return await provider.send("eth_requestAccounts", []);
  } catch (error) {
    if (error?.code === -32002) {
      throw new Error(
        "MetaMask request already pending. Open MetaMask and approve first."
      );
    }
    throw error;
  }
}

export async function ensureCorrectNetwork(provider) {
  const network = await provider.getNetwork();
  if (Number(network.chainId) === HARDHAT_LOCALHOST_CHAIN_ID) {
    return;
  }

  const targetChainHex = `0x${HARDHAT_LOCALHOST_CHAIN_ID.toString(16)}`;
  try {
    await provider.send("wallet_switchEthereumChain", [{ chainId: targetChainHex }]);
  } catch (error) {
    if (error?.code === 4902) {
      await provider.send("wallet_addEthereumChain", [
        {
          chainId: targetChainHex,
          chainName: "Hardhat Localhost",
          rpcUrls: [LOCAL_RPC_URL],
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        },
      ]);
      return;
    }
    throw new Error(
      "Wrong network in MetaMask. Switch to Hardhat Localhost (chainId 31337)."
    );
  }
}

export async function ensureContractCode(provider) {
  if (
    !contractAddress ||
    contractAddress === "0x0000000000000000000000000000000000000000"
  ) {
    throw new Error(
      "Contract address is not configured. Run blockchain deploy first."
    );
  }

  if (isContractCodeValidated) {
    return;
  }

  let code = "0x";
  try {
    code = await provider.getCode(contractAddress);
  } catch (error) {
    const rpcMessage = String(error?.message || "");
    const isRateLimit =
      error?.code === -32002 ||
      rpcMessage.includes("too many errors") ||
      rpcMessage.includes("retrying in");

    if (!isRateLimit) {
      throw error;
    }

    // Fallback to local Hardhat RPC when wallet RPC is throttled.
    code = await getLocalReadProvider().getCode(contractAddress);
  }

  if (!code || code === "0x") {
    throw new Error(
      `No contract found at ${contractAddress}. Redeploy and update config.`
    );
  }

  isContractCodeValidated = true;
}

export function getReadOnlyContract(provider) {
  return new ethers.Contract(contractAddress, abi, provider);
}

export function getWriteContract(signer) {
  return new ethers.Contract(contractAddress, abi, signer);
}

export function getContractRuntimeConfig() {
  return {
    contractAddress,
    chainId: HARDHAT_LOCALHOST_CHAIN_ID,
    version: LAND_REGISTRY_VERSION || "legacy",
  };
}
