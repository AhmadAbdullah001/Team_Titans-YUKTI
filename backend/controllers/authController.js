const crypto = require("crypto");
const User = require("../DBmodels/User");

const ALLOWED_ROLES = new Set(["citizen", "registrar", "bank"]);

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, originalHash] = String(stored).split(":");
  if (!salt || !originalHash) return false;
  const nextHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  const a = Buffer.from(originalHash, "hex");
  const b = Buffer.from(nextHash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const normalizedRole = String(role).toLowerCase();
    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return res.status(400).json({ message: "Invalid role selected." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered." });
    }

    const hashedPassword = hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: normalizedRole,
    });

    return res.status(201).json({
      message: "Signup successful.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[auth/signup] error:", error);
    return res.status(500).json({ message: "Signup failed." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isPasswordValid = verifyPassword(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    return res.status(200).json({
      message: "Login successful.",
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error("[auth/login] error:", error);
    return res.status(500).json({ message: "Login failed." });
  }
};
