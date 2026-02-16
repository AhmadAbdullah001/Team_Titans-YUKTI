const express = require("express");
const crypto = require("crypto");
const { ethers } = require("ethers");
const TransferCode = require("../DBmodels/TransferCode");
const User = require("../DBmodels/User");

const router = express.Router();
const REGISTERED = 2;

const CONTRACT_ADDRESS = String(process.env.CONTRACT_ADDRESS || "").trim();
const BLOCKCHAIN_RPC_URL = String(process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545").trim();
const READ_ABI = [
  "function hashToPropertyId(string) view returns (uint256)",
  "function getProperty(uint256) view returns (uint256 id,address owner,string ipfsHash,bool registrarApproved,bool notaryApproved,bool authorityApproved,uint256 approvalCount,uint8 status,bool bankVerified)",
  "function propertyCounter() view returns (uint256)",
  "function properties(uint256) view returns (uint256 id,address owner,string ipfsHash,bool registrarApproved,bool notaryApproved,bool authorityApproved,uint256 approvalCount,uint8 status,bool bankVerified)",
  "function getOwner(string hash) view returns (address)",
  "function documentOwner(string hash) view returns (address)",
  "function verifyProperty(string hash) view returns (bool)",
  "function verifyHash(string hash) view returns (bool)",
];

function getReadContract() {
  if (!CONTRACT_ADDRESS || !ethers.isAddress(CONTRACT_ADDRESS)) {
    throw new Error("Invalid or missing CONTRACT_ADDRESS");
  }
  const provider = new ethers.JsonRpcProvider(BLOCKCHAIN_RPC_URL);
  return new ethers.Contract(CONTRACT_ADDRESS, READ_ABI, provider);
}

async function getPropertyFromChainByHash(ipfsHash) {
  const contract = getReadContract();
  const normalizedHash = String(ipfsHash || "").trim();
  if (!normalizedHash) {
    throw new Error("Property hash is required");
  }

  // Preferred eVault path: resolve propertyId by hash mapping, then read by id.
  try {
    const propertyId = Number(await contract.hashToPropertyId(normalizedHash));
    if (propertyId > 0) {
      let row;
      try {
        row = await contract.getProperty(propertyId);
      } catch {
        row = await contract.properties(propertyId);
      }

      return {
        id: Number(row.id || propertyId),
        owner: String(row.owner || ""),
        status: Number(row.status || 0),
      };
    }
  } catch {
    // fallback below
  }

  // eVault path: lookup by iterating indexed properties(uint256)
  try {
    const count = Number(await contract.propertyCounter());
    for (let i = count; i >= 1; i -= 1) {
      const row = await contract.properties(i);
      const rowHash = String(row?.ipfsHash || "").trim();
      if (rowHash === normalizedHash) {
        return {
          id: Number(row.id || i),
          owner: String(row.owner || ""),
          status: Number(row.status || 0),
        };
      }
    }
  } catch {
    // fallback below for legacy DocumentVault ABI
  }

  // Legacy path: derive owner + verification by hash directly.
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

  let isVerified = false;
  try {
    isVerified = await contract.verifyProperty(normalizedHash);
  } catch {
    try {
      isVerified = await contract.verifyHash(normalizedHash);
    } catch {
      isVerified = false;
    }
  }

  if (String(owner || "").toLowerCase() !== ethers.ZeroAddress.toLowerCase()) {
    return {
      id: 0,
      owner: String(owner),
      status: isVerified ? REGISTERED : 0,
    };
  }

  return null;
}

function maskAadhaar(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (raw.length !== 12) return null;
  return `XXXXXXXX${raw.slice(-4)}`;
}

function createTransferCode() {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

// POST /api/transfer/generate-code
// body: { walletAddress }
router.post("/generate-code", async (req, res) => {
  try {
    const walletAddress = String(req.body?.walletAddress || "").trim().toLowerCase();
    if (!walletAddress) {
      return res.status(400).json({ message: "walletAddress is required" });
    }
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({ message: "Invalid Ethereum wallet address format" });
    }

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let created = null;
    for (let attempts = 0; attempts < 5; attempts += 1) {
      try {
        created = await TransferCode.create({
          code: createTransferCode(),
          walletAddress,
          expiresAt,
          isUsed: false,
        });
        break;
      } catch (error) {
        if (error?.code !== 11000) throw error;
      }
    }

    if (!created) {
      return res.status(500).json({ message: "Failed to generate transfer code. Try again." });
    }

    return res.status(201).json({
      code: created.code,
      walletAddress: created.walletAddress,
      expiresAt: created.expiresAt,
      isUsed: created.isUsed,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to generate transfer code" });
  }
});

// GET /api/transfer/resolve/:code
router.get("/resolve/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ message: "Transfer code is required" });
    }

    const record = await TransferCode.findOne({ code });
    if (!record) {
      return res.status(404).json({ message: "Transfer code not found" });
    }
    if (record.isUsed) {
      return res.status(400).json({ message: "Transfer code already used" });
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ message: "Transfer code expired" });
    }

    const user = await User.findOne({ walletAddress: record.walletAddress }).select(
      "_id name role aadhaar employeeId walletAddress createdAt"
    );

    return res.json({
      code: record.code,
      walletAddress: record.walletAddress,
      expiresAt: record.expiresAt,
      isUsed: record.isUsed,
      user: user
        ? {
            id: user._id,
            name: user.name,
            role: user.role,
            aadhaar: maskAadhaar(user.aadhaar),
            employeeId: user.employeeId || null,
            walletAddress: user.walletAddress || null,
            createdAt: user.createdAt,
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to resolve transfer code" });
  }
});

// POST /api/transfer/validate
// body: { hash, walletAddress }
router.post("/validate", async (req, res) => {
  try {
    const hash = String(req.body?.hash || "").trim();
    const walletAddress = String(req.body?.walletAddress || "").trim().toLowerCase();

    if (!hash) {
      return res.status(400).json({ message: "hash is required" });
    }
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      return res.status(400).json({ message: "Valid walletAddress is required" });
    }

    const property = await getPropertyFromChainByHash(hash);
    if (!property) {
      return res.status(404).json({ message: "Property not found on blockchain" });
    }

    console.log("Blockchain owner:", property.owner);
    console.log("Connected wallet:", walletAddress);
    console.log("Blockchain status:", property.status);

    if (Number(property.status) !== REGISTERED) {
      return res.status(400).json({ message: "Property not verified on blockchain" });
    }

    if (String(property.owner || "").toLowerCase() !== walletAddress) {
      return res.status(403).json({ message: "Only property owner can transfer" });
    }

    return res.json({
      message: "Transfer validation successful",
      property,
    });
  } catch (error) {
    return res.status(500).json({
      message: `Transfer validation failed: ${error?.message || "Unknown blockchain error"}`,
    });
  }
});

module.exports = router;
