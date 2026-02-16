const express = require("express");
const File = require("../DBmodels/fileSchema");
const User = require("../DBmodels/User");
const TransferCode = require("../DBmodels/TransferCode");
const {
  getOwnerOnChain,
  getVerificationStatusOnChain,
  hasReadConfig,
  hasSignerConfig,
  storeHashOnChain,
} = require("../services/blockchainService");
const { ethers } = require("ethers");

const router = express.Router();

function computeDecisionStats(fileDoc) {
  const decisions = Object.values(fileDoc?.roleDecisions || {})
    .map((item) => item?.decision)
    .filter(Boolean);
  const approvalCount = decisions.filter((d) => d === "approve").length;
  const rejectCount = decisions.filter((d) => d === "reject").length;
  return { approvalCount, rejectCount };
}

function reconcileWorkflowState(fileDoc) {
  const { approvalCount, rejectCount } = computeDecisionStats(fileDoc);
  fileDoc.approvalCount = approvalCount;
  fileDoc.rejectCount = rejectCount;

  if (rejectCount >= 2) {
    fileDoc.workflowStatus = "rejected";
    fileDoc.verified = false;
    fileDoc.verifiedAt = null;
    fileDoc.verifiedBy = null;
    return;
  }

  if (approvalCount >= 2) {
    // Approved only if chain verification is true; otherwise pending chain push.
    fileDoc.workflowStatus = fileDoc.verified ? "approved" : "approved_pending_chain";
    return;
  }

  fileDoc.workflowStatus = "pending";
  if (!fileDoc.verified) {
    fileDoc.verifiedAt = null;
    fileDoc.verifiedBy = null;
  }
}

async function syncFileWithChain(fileDoc) {
  if (!hasReadConfig()) return fileDoc;

  try {
    const previousOwner = fileDoc.currentOwnerWallet;
    const [owner, verified] = await Promise.all([
      getOwnerOnChain(fileDoc.ipfshash),
      getVerificationStatusOnChain(fileDoc.ipfshash),
    ]);

    const ownerWallet =
      owner && owner !== ethers.ZeroAddress ? String(owner) : fileDoc.currentOwnerWallet;

    let changed = false;
    const previousOwnerNormalized = String(previousOwner || "").trim().toLowerCase();
    const hasPreviousRealOwner =
      Boolean(previousOwnerNormalized) && previousOwnerNormalized !== ethers.ZeroAddress.toLowerCase();

    if (ownerWallet && ownerWallet !== fileDoc.currentOwnerWallet) {
      fileDoc.currentOwnerWallet = ownerWallet;
      if (hasPreviousRealOwner) {
        fileDoc.lastTransferAt = new Date();
        fileDoc.transferCount = Number(fileDoc.transferCount || 0) + 1;
      }
      changed = true;
    }

    if (typeof verified === "boolean" && verified !== fileDoc.verified) {
      fileDoc.verified = verified;
      if (verified && !fileDoc.verifiedAt) {
        fileDoc.verifiedAt = new Date();
      }
      if (!verified) {
        fileDoc.verifiedAt = null;
      }
      changed = true;
    }

    if (changed) {
      await fileDoc.save();
    }
  } catch {
    // best effort sync; do not fail API if chain is unavailable
  }

  return fileDoc;
}

// GET /api/files
// Registrar/Notary/LocalAuthority can view all files.
router.get("/", async (req, res) => {
  try {
    const role = String(req.query.role || req.headers["x-role"] || "").toLowerCase();
    if (!["registrar", "notary", "localauthority"].includes(role)) {
      return res.status(403).json({ message: "Registrar/Notary/LocalAuthority access required", files: [] });
    }

    const files = await File.find().sort({ uploadedAt: -1 });
    await Promise.all(
      files.map(async (doc) => {
        let changed = false;
        await syncFileWithChain(doc);
        const prevWorkflow = String(doc.workflowStatus || "");
        const prevApprove = Number(doc.approvalCount || 0);
        const prevReject = Number(doc.rejectCount || 0);
        const prevVerified = Boolean(doc.verified);
        reconcileWorkflowState(doc);
        if (
          prevWorkflow !== String(doc.workflowStatus || "") ||
          prevApprove !== Number(doc.approvalCount || 0) ||
          prevReject !== Number(doc.rejectCount || 0) ||
          prevVerified !== Boolean(doc.verified)
        ) {
          changed = true;
        }
        if (changed) {
          await doc.save();
        }
      })
    );
    return res.json({ files });
  } catch (error) {
    console.error("[files/getAll] error:", error);
    return res.status(500).json({ message: "Failed to fetch files", files: [] });
  }
});

// GET /api/files/:userId
// Citizen can view own files.
router.get("/:userId", async (req, res) => {
  try {
    const role = String(req.query.role || req.headers["x-role"] || "").toLowerCase();
    const { userId } = req.params;
    const extraIds = String(req.query.ids || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const email = String(req.query.email || "").trim();
    const name = String(req.query.name || "").trim();
    const walletAddress = String(req.query.walletAddress || "").trim().toLowerCase();

    if (role !== "citizen") {
      return res.status(403).json({ message: "Citizen access required", files: [] });
    }

    const ids = Array.from(new Set([userId, ...extraIds, email].filter(Boolean)));

    // Legacy compatibility: include name-based ownership only if name is unique in user DB.
    if (name) {
      const sameNameCount = await User.countDocuments({ name });
      if (sameNameCount <= 1) {
        ids.push(name);
      }
    }

    // Wallet-aware listing for citizens:
    // - include files uploaded by this user (legacy behavior)
    // - include files currently owned by this wallet (after transfers)
    const allFiles = await File.find().sort({ uploadedAt: -1 });
    await Promise.all(allFiles.map((doc) => syncFileWithChain(doc)));

    const files = allFiles.filter((doc) => {
      const byUserId = ids.includes(String(doc.userID || ""));
      const ownerWallet = String(doc.currentOwnerWallet || "").trim().toLowerCase();
      const byWallet = walletAddress ? ownerWallet === walletAddress : false;
      return byUserId || byWallet;
    });

    return res.json({ files });
  } catch (error) {
    console.error("[files/getByUser] error:", error);
    return res.status(500).json({ message: "Failed to fetch user files", files: [] });
  }
});

// PATCH /api/files/review
// Registrar/Notary/LocalAuthority can approve/reject.
// 2 approvals => push hash on-chain and mark approved.
// 2 rejects => mark rejected.
router.patch("/review", async (req, res) => {
  try {
    const role = String(req.body?.role || req.query.role || req.headers["x-role"] || "").toLowerCase();
    const { hash, reviewerWallet, decision, rejectionReason } = req.body || {};

    const normalizedRole =
      role === "localauthority" ? "localAuthority" : role;
    if (!["registrar", "notary", "localAuthority", "citizen"].includes(normalizedRole)) {
      return res.status(403).json({ message: "Registrar/Notary/LocalAuthority/Citizen access required" });
    }

    if (!hash) {
      return res.status(400).json({ message: "Hash is required" });
    }

    const normalizedDecision = String(decision || "").toLowerCase();
    if (!["approve", "reject"].includes(normalizedDecision)) {
      return res.status(400).json({ message: "Decision must be approve or reject" });
    }
    const normalizedRejectionReason = String(rejectionReason || "").trim();
    if (normalizedDecision === "reject" && !normalizedRejectionReason) {
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    const file = await File.findOne({ ipfshash: hash });
    if (!file) {
      return res.status(404).json({ message: "Document not found for hash" });
    }

    reconcileWorkflowState(file);

    if (["approved", "rejected"].includes(String(file.workflowStatus || ""))) {
      return res.status(400).json({ message: `Request already ${file.workflowStatus}` });
    }

    const existingDecision = file?.roleDecisions?.[normalizedRole]?.decision || null;
    if (existingDecision) {
      await file.save();
      return res.status(200).json({
        message: `${normalizedRole} already reviewed this request as ${existingDecision}`,
        file,
      });
    }

    if (!file.roleDecisions) {
      file.roleDecisions = {};
    }
    file.roleDecisions[normalizedRole] = {
      decision: normalizedDecision,
      reason: normalizedDecision === "reject" ? normalizedRejectionReason : null,
      by: reviewerWallet || null,
      at: new Date(),
    };

    reconcileWorkflowState(file);
    const approvalCount = Number(file.approvalCount || 0);
    const rejectCount = Number(file.rejectCount || 0);

    if (rejectCount >= 2) {
      file.workflowStatus = "rejected";
      file.verified = false;
      file.verifiedAt = null;
      file.verifiedBy = null;
      await file.save();
      return res.json({ message: "Request rejected (2 rejects reached)", file });
    }

    if (approvalCount >= 2) {
      file.workflowStatus = "approved_pending_chain";
      file.verified = false;
      file.verifiedAt = null;
      file.verifiedBy = null;
      file.chainTxHash = null;
      file.chainPushedAt = null;
      await file.save();

      return res.json({
        message:
          "2 approvals received. Citizen can now click 'Push on Blockchain' from Citizen Dashboard via MetaMask.",
        file,
      });
    }

    file.workflowStatus = "pending";
    await file.save();

    return res.json({ message: "Review saved. Waiting for more decisions.", file });
  } catch (error) {
    console.error("[files/review] error:", error);
    return res.status(500).json({ message: "Failed to process review decision" });
  }
});

// PATCH /api/files/retry-chain-push
// Retry blockchain push for requests that already have >=2 approvals but were pending due to signer/config issues.
router.patch("/retry-chain-push", async (req, res) => {
  try {
    const role = String(req.body?.role || req.query.role || req.headers["x-role"] || "").toLowerCase();
    const { hash } = req.body || {};
    const normalizedRole =
      role === "localauthority" ? "localAuthority" : role;

    if (!["registrar", "notary", "localAuthority", "citizen"].includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Registrar/Notary/LocalAuthority/Citizen access required" });
    }

    if (!hash) {
      return res.status(400).json({ message: "Hash is required" });
    }

    const file = await File.findOne({ ipfshash: String(hash).trim() });
    if (!file) {
      return res.status(404).json({ message: "Document not found for hash" });
    }

    if (Number(file.approvalCount || 0) < 2) {
      return res.status(400).json({ message: "At least 2 approvals are required before chain push" });
    }

    if (!hasSignerConfig()) {
      return res.status(503).json({
        message:
          "Blockchain signer config missing. Set CONTRACT_ADDRESS and BLOCKCHAIN_PRIVATE_KEY, then retry.",
      });
    }

    const chainResult = await storeHashOnChain(file.ipfshash);
    const chainTxHash = chainResult?.txHash || null;

    file.workflowStatus = "approved";
    file.verified = true;
    file.verifiedAt = new Date();
    file.verifiedBy = "multi-role";
    file.chainTxHash = chainTxHash;
    file.chainPushedAt = chainTxHash ? new Date() : null;
    await file.save();

    return res.json({ message: "Hash pushed on-chain successfully", file });
  } catch (error) {
    return res.status(500).json({
      message: `Retry chain push failed: ${error?.message || "Unknown blockchain error"}`,
    });
  }
});

// PATCH /api/files/confirm-chain-push
// Mark workflow approved after successful wallet-signed on-chain push from frontend.
router.patch("/confirm-chain-push", async (req, res) => {
  try {
    const role = String(req.body?.role || req.query.role || req.headers["x-role"] || "").toLowerCase();
    const { hash, txHash } = req.body || {};
    const normalizedRole =
      role === "localauthority" ? "localAuthority" : role;

    if (!["registrar", "notary", "localAuthority", "citizen"].includes(normalizedRole)) {
      return res
        .status(403)
        .json({ message: "Registrar/Notary/LocalAuthority/Citizen access required" });
    }

    if (!hash) {
      return res.status(400).json({ message: "Hash is required" });
    }

    const file = await File.findOne({ ipfshash: String(hash).trim() });
    if (!file) {
      return res.status(404).json({ message: "Document not found for hash" });
    }

    if (Number(file.approvalCount || 0) < 2) {
      return res.status(400).json({ message: "At least 2 approvals are required before confirmation" });
    }

    file.workflowStatus = "approved";
    file.verified = true;
    file.verifiedAt = new Date();
    file.verifiedBy = "multi-role";
    file.chainTxHash = txHash || file.chainTxHash || null;
    file.chainPushedAt = new Date();
    await file.save();

    return res.json({ message: "Chain push confirmed and workflow approved", file });
  } catch (error) {
    return res.status(500).json({
      message: `Confirm chain push failed: ${error?.message || "Unknown error"}`,
    });
  }
});

// PATCH /api/files/transfer-owner
// Sync DB owner after successful on-chain transfer.
router.patch("/transfer-owner", async (req, res) => {
  try {
    const role = String(req.body?.role || req.query.role || req.headers["x-role"] || "").toLowerCase();
    const { hash, newOwnerWallet, transferCode } = req.body || {};

    if (role !== "citizen") {
      return res.status(403).json({ message: "Citizen access required" });
    }

    if (!hash || !newOwnerWallet) {
      return res.status(400).json({ message: "hash and newOwnerWallet are required" });
    }

    const normalizedOwner = String(newOwnerWallet).trim().toLowerCase();
    const normalizedCode = String(transferCode || "").trim().toUpperCase();

    if (normalizedCode) {
      const codeDoc = await TransferCode.findOne({ code: normalizedCode });
      if (!codeDoc) {
        return res.status(404).json({ message: "Transfer code not found" });
      }
      if (codeDoc.isUsed) {
        return res.status(400).json({ message: "Transfer code already used" });
      }
      if (new Date(codeDoc.expiresAt).getTime() <= Date.now()) {
        return res.status(400).json({ message: "Transfer code expired" });
      }
      if (String(codeDoc.walletAddress || "").toLowerCase() !== normalizedOwner) {
        return res.status(400).json({ message: "Transfer code does not match new owner wallet" });
      }
    }

    const ownerOnChain = String(await getOwnerOnChain(String(hash).trim()) || "").trim().toLowerCase();
    if (!ownerOnChain || ownerOnChain === ethers.ZeroAddress.toLowerCase()) {
      return res.status(400).json({ message: "On-chain owner not found. Sync aborted." });
    }
    if (ownerOnChain !== normalizedOwner) {
      return res.status(400).json({
        message: `On-chain owner mismatch. Expected ${normalizedOwner}, found ${ownerOnChain}.`,
      });
    }

    const updated = await File.findOneAndUpdate(
      { ipfshash: String(hash).trim() },
      {
        $set: {
          currentOwnerWallet: ownerOnChain,
          verified: false,
          verifiedAt: null,
          verifiedBy: null,
          workflowStatus: "pending",
          approvalCount: 0,
          rejectCount: 0,
          roleDecisions: {
            registrar: { decision: null, reason: null, by: null, at: null },
            notary: { decision: null, reason: null, by: null, at: null },
            localAuthority: { decision: null, reason: null, by: null, at: null },
          },
          chainTxHash: null,
          chainPushedAt: null,
        },
        $inc: { transferCount: 1 },
        $currentDate: { lastTransferAt: true },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Document not found for hash" });
    }

    if (normalizedCode) {
      await TransferCode.updateOne(
        { code: normalizedCode },
        { $set: { isUsed: true } }
      );
    }

    return res.json({ message: "Owner updated", file: updated });
  } catch (error) {
    console.error("[files/transfer-owner] error:", error);
    return res.status(500).json({ message: "Failed to update transfer owner" });
  }
});

module.exports = router;
