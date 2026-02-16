const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    aadhaar: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    employeeId: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ["citizen", "registrar", "notary", "localAuthority"],
      required: true,
    },
    walletAddress: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    versionKey: false,
  }
);

userSchema.pre("validate", function () {
  const aadhaarRegex = /^[0-9]{12}$/;

  if (this.role === "citizen") {
    if (!this.aadhaar || !aadhaarRegex.test(String(this.aadhaar))) {
      throw new Error("Citizen must have a valid 12-digit Aadhaar.");
    }
    this.employeeId = undefined;
  }

  if (
    this.role === "registrar" ||
    this.role === "notary" ||
    this.role === "localAuthority"
  ) {
    if (!this.employeeId || !String(this.employeeId).trim()) {
      throw new Error("Registrar/Notary/LocalAuthority must have employeeId.");
    }
    this.aadhaar = undefined;
  }
});

module.exports = mongoose.model("User", userSchema);
