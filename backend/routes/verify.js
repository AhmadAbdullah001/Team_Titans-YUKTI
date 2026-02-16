const File=require('../DBmodels/fileSchema')
const express=require('express')
const {
  getOwnerOnChain,
  getVerificationStatusOnChain,
  hasReadConfig,
} = require("../services/blockchainService");
const { ethers } = require("ethers");
const router=express.Router()
router.post("/", async (req, res) => {
  const { hash } = req.body;
    console.log(hash)
  const existing = await File.findOne({ ipfshash: hash });

  if (existing) {
    if (hasReadConfig()) {
      try {
        const [owner, verified] = await Promise.all([
          getOwnerOnChain(hash),
          getVerificationStatusOnChain(hash),
        ]);

        if (owner && owner !== ethers.ZeroAddress) {
          existing.currentOwnerWallet = owner;
        }

        if (typeof verified === "boolean") {
          existing.verified = verified;
          existing.verifiedAt = verified ? existing.verifiedAt || new Date() : null;
        }

        await existing.save();
      } catch {
        // no-op; keep DB fallback behavior
      }
    }

    return res.json({
      status: "Authentic",
      owner: existing.userID,
      currentOwnerWallet: existing.currentOwnerWallet || null,
      verified: Boolean(existing.verified),
    });
  }

  return res.json({
    status: "Not Found / Tampered",
  });
});

module.exports=router
