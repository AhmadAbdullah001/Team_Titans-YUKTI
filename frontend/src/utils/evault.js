import { ethers } from "ethers";
import { getEVaultContract } from "./web3.js";

export function statusLabel(status) {
  const value = Number(status);
  if (value === 0) return "Pending";
  if (value === 1) return "Rejected";
  if (value === 2) return "Registered";
  return "Unknown";
}

export async function requestRegistration(ipfsHash) {
  const contract = await getEVaultContract(true);
  const tx = await contract.requestRegistration(ipfsHash);
  await tx.wait();
  return tx.hash;
}

export async function approveProperty(propertyId) {
  const contract = await getEVaultContract(true);
  const tx = await contract.approveProperty(propertyId);
  await tx.wait();
  return tx.hash;
}

export async function transferProperty(propertyId, newOwner) {
  const contract = await getEVaultContract(true);
  const tx = await contract.transferProperty(propertyId, newOwner);
  await tx.wait();
  return tx.hash;
}

export async function verifyByBank(propertyId) {
  const contract = await getEVaultContract(true);
  const tx = await contract.verifyByBank(propertyId);
  await tx.wait();
  return tx.hash;
}

export async function getPropertyCounter() {
  const contract = await getEVaultContract(false);
  return Number(await contract.propertyCounter());
}

export async function getProperty(propertyId) {
  const contract = await getEVaultContract(false);
  const property = await contract.properties(propertyId);
  return {
    id: Number(property.id),
    owner: property.owner,
    ipfsHash: property.ipfsHash,
    registrarApproved: Boolean(property.registrarApproved),
    notaryApproved: Boolean(property.notaryApproved),
    authorityApproved: Boolean(property.authorityApproved),
    approvalCount: Number(property.approvalCount),
    status: Number(property.status),
    bankVerified: Boolean(property.bankVerified),
  };
}

export async function getAllProperties() {
  const count = await getPropertyCounter();
  if (count === 0) return [];
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const properties = await Promise.all(ids.map((id) => getProperty(id)));
  return properties.filter((property) => property.id > 0);
}

export async function getOwnershipHistory(propertyId) {
  const contract = await getEVaultContract(false);
  const records = await contract.getOwnershipHistory(propertyId);
  return records.map((record) => ({
    owner: record.owner,
    timestamp: Number(record.timestamp),
    readableTime:
      Number(record.timestamp) > 0
        ? new Date(Number(record.timestamp) * 1000).toLocaleString()
        : "-",
  }));
}

export function isValidAddress(value) {
  return ethers.isAddress(value);
}
