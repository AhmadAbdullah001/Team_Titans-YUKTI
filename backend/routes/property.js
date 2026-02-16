const express = require("express");
const { ethers } = require("ethers");
const User = require("../DBmodels/User");
const { getOwnerOnChain } = require("../services/blockchainService");

const router = express.Router();

function maskAadhaar(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (raw.length !== 12) return null;
  return `XXXXXXXX${raw.slice(-4)}`;
}

// GET /api/property/:hash
// Resolve owner from chain and map to user details by walletAddress.
router.get("/:hash", async (req, res) => {
  try {
    const role = String(req.query.role || req.headers["x-role"] || "").toLowerCase();
    if (!["registrar", "notary", "localauthority"].includes(role)) {
      return res.status(403).json({ message: "Only registrar, notary, and local authority can search by property hash" });
    }

    const hash = String(req.params.hash || "").trim();
    if (!hash) {
      return res.status(400).json({ message: "Property hash is required" });
    }

    const owner = String(await getOwnerOnChain(hash) || "").toLowerCase();
    if (!owner || owner === ethers.ZeroAddress.toLowerCase()) {
      return res.status(404).json({ message: "Property owner not found on-chain" });
    }

    const user = await User.findOne({ walletAddress: owner }).select(
      "name role aadhaar walletAddress"
    );

    return res.json({
      walletAddress: owner,
      name: user?.name || null,
      role: user?.role || null,
      aadhaar: maskAadhaar(user?.aadhaar),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch property owner details" });
  }
});

module.exports = router;
