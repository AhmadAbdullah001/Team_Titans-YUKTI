const express = require('express');
const router = express.Router();
const crypto = require("crypto");
const { ethers } = require("ethers");
const User = require('../DBmodels/User');

const AADHAAR_REGEX = /^[0-9]{12}$/;

function maskAadhaar(value) {
  const raw = String(value || "").replace(/\D/g, "");
  if (raw.length !== 12) return null;
  return `XXXXXXXX${raw.slice(-4)}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const value = String(stored || "");
  const [salt, originalHash] = value.split(":");

  // Backward compatibility for previously saved plain-text passwords.
  if (!salt || !originalHash) {
    return value === password;
  }

  const nextHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  const a = Buffer.from(originalHash, "hex");
  const b = Buffer.from(nextHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, role, aadhaar, employeeId, password, walletAddress } = req.body;

    if (!name || !role || !password) {
      return res.status(400).json({ error: 'Name, role, and password are required' });
    }

    if (!['citizen', 'registrar', 'notary', 'localAuthority'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    if (!walletAddress || !String(walletAddress).trim()) {
      return res.status(400).json({ error: "walletAddress is required" });
    }
    const normalizedWallet = String(walletAddress).trim().toLowerCase();
    if (!ethers.isAddress(normalizedWallet)) {
      return res.status(400).json({ error: "Invalid Ethereum wallet address format" });
    }

    const userData = {
      name: String(name).trim(),
      password: hashPassword(password),
      role,
      walletAddress: normalizedWallet,
    };

    let existing;
    if (role === "citizen") {
      if (!AADHAAR_REGEX.test(String(aadhaar || ""))) {
        return res.status(400).json({ error: 'Aadhaar must be exactly 12 digits' });
      }
      const value = String(aadhaar).trim();
      userData.aadhaar = value;
      existing = await User.findOne({ aadhaar: value });
    } else {
      if (!employeeId || !String(employeeId).trim()) {
        return res.status(400).json({ error: 'Employee ID is required for registrar/notary/localAuthority signup' });
      }
      const value = String(employeeId).trim();
      userData.employeeId = value;
      existing = await User.findOne({ employeeId: value });
    }

    if (existing) {
      return res.status(409).json({ error: 'User already exists with this identifier' });
    }

    const user = new User(userData);

    await user.save();

    const safeUser = {
      id: user._id,
      name: user.name,
      role: user.role,
      aadhaar: user.role === "citizen" ? user.aadhaar : undefined,
      employeeId: user.role !== "citizen" ? user.employeeId : undefined,
      walletAddress: user.walletAddress || undefined,
      createdAt: user.createdAt,
    };

    return res.status(201).json({ user: safeUser });
  } catch (error) {
    console.error('Signup error', error);
    if (error?.code === 11000) {
      const field = Object.keys(error?.keyPattern || {})[0] || "field";
      return res.status(409).json({ error: `Duplicate value for ${field}` });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { role, aadhaar, employeeId, password } = req.body;
    if (!role || !password) {
      return res.status(400).json({ error: 'Role and password are required' });
    }

    if (!['citizen', 'registrar', 'notary', 'localAuthority'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    let query = { role };

    if (role === 'citizen') {
      if (!aadhaar || !AADHAAR_REGEX.test(String(aadhaar))) {
        return res.status(400).json({ error: 'Valid 12-digit Aadhaar is required for citizen login' });
      }
      query.aadhaar = String(aadhaar).trim();
    } else {
      if (!employeeId || !String(employeeId).trim()) {
        return res.status(400).json({ error: 'Employee ID is required for registrar/notary/localAuthority login' });
      }
      query.employeeId = String(employeeId).trim();
    }

    const user = await User.findOne(query);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = verifyPassword(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    // Auto-migrate old plain-text password records to hashed format.
    if (!String(user.password).includes(":")) {
      user.password = hashPassword(password);
      await user.save();
    }

    const safeUser = {
      id: user._id,
      name: user.name,
      role: user.role,
      aadhaar: user.role === "citizen" ? user.aadhaar : undefined,
      employeeId: user.role !== "citizen" ? user.employeeId : undefined,
      walletAddress: user.walletAddress || undefined,
      createdAt: user.createdAt,
    };

    return res.json({ user: safeUser });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// PATCH /api/auth/save-wallet
router.patch("/save-wallet", async (req, res) => {
  try {
    const { userId, walletAddress } = req.body || {};
    if (!userId || !String(userId).trim()) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (!walletAddress || !String(walletAddress).trim()) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    const normalizedWallet = String(walletAddress).trim().toLowerCase();
    if (!ethers.isAddress(normalizedWallet)) {
      return res.status(400).json({ error: "Invalid Ethereum wallet address format" });
    }

    const user = await User.findByIdAndUpdate(
      String(userId).trim(),
      { $set: { walletAddress: normalizedWallet } },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const safeUser = {
      id: user._id,
      name: user.name,
      role: user.role,
      aadhaar: user.role === "citizen" ? user.aadhaar : undefined,
      employeeId: user.role !== "citizen" ? user.employeeId : undefined,
      walletAddress: user.walletAddress || undefined,
      createdAt: user.createdAt,
    };

    return res.json({ user: safeUser });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: "Wallet address already linked to another account" });
    }
    return res.status(500).json({ error: "Failed to save wallet address" });
  }
});

// GET /api/auth/registrars
// Returns registrar users from MongoDB so admin can grant on-chain registrar role.
router.get("/registrars", async (_req, res) => {
  try {
    const users = await User.find({ role: "registrar" })
      .sort({ createdAt: -1 })
      .select("_id name role employeeId walletAddress createdAt");

    const registrars = (users || []).map((user) => ({
      id: user._id,
      name: user.name,
      role: user.role,
      employeeId: user.employeeId,
      walletAddress: user.walletAddress || null,
      createdAt: user.createdAt,
    }));

    return res.json({ registrars });
  } catch (error) {
    return res.status(500).json({ error: "Failed to fetch registrar users" });
  }
});

// GET /api/auth/user-by-wallet/:walletAddress
// Registrar, notary, and local authority can search user details by wallet address.
router.get("/user-by-wallet/:walletAddress", async (req, res) => {
  try {
    const role = String(req.query.role || req.headers["x-role"] || "").toLowerCase();
    if (!["registrar", "notary", "localauthority"].includes(role)) {
      return res.status(403).json({ error: "Only registrar, notary, and local authority can search user details" });
    }

    const walletAddress = String(req.params.walletAddress || "").trim().toLowerCase();
    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({ error: "Invalid Ethereum wallet address format" });
    }

    const user = await User.findOne({ walletAddress }).select(
      "_id name role aadhaar employeeId walletAddress createdAt"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found for this wallet address" });
    }

    return res.json({
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        aadhaar: maskAadhaar(user.aadhaar),
        employeeId: user.employeeId || null,
        walletAddress: user.walletAddress || null,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: "Failed to search user by wallet" });
  }
});

module.exports = router;
