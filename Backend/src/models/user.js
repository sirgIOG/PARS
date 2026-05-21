import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // 👤 Basic Info
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    // 🔑 Role
    role: {
      type: String,
      enum: ["admin", "hospital", "dispatcher", "paramedic", "driver"],
      default: "paramedic",
    },

    // 🚑 Associated Ambulance (for drivers/paramedics)
    ambulanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
    },

    // 🏥 Associated Hospital (for hospital admin)
    hospitalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },

    // 📞 Contact
    phone: {
      type: String,
    },

    // ✅ Account Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // 🔐 Account Verification
    isVerified: {
      type: Boolean,
      default: false,
    },

    // Last login
    lastLogin: {
      type: Date,
    },

    // Login attempts (for security)
    loginAttempts: {
      type: Number,
      default: 0,
    },

    // Lock account after failed attempts
    isLocked: {
      type: Boolean,
      default: false,
    },

    lockedUntil: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("User", userSchema);
