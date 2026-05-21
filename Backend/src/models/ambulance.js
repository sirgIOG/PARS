import mongoose from "mongoose";

const ambulanceSchema = new mongoose.Schema(
  {
    // 🚑 Ambulance Info
    ambulanceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // 📋 Ambulance Details
    numberPlate: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    // 👨‍💼 Driver Info
    driver: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
      licenseNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
      },
      licenseExpiry: {
        type: Date,
      },
    },

    // 🚑 Vehicle Details
    vehicle: {
      model: {
        type: String,
        required: true,
      },
      manufacturingYear: {
        type: Number,
      },
      color: {
        type: String,
      },
      capacity: {
        type: Number,
        default: 4, // max patients
      },
      lastServiceDate: {
        type: Date,
      },
      nextServiceDue: {
        type: Date,
      },
    },

    // 📍 Location & Status
    currentLocation: {
      lat: {
        type: Number,
      },
      lng: {
        type: Number,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },

    // 🔴 Status
    status: {
      type: String,
      enum: ["available", "on-duty", "maintenance", "inactive"],
      default: "available",
    },

    // 🧭 Service Level
    serviceLevel: {
      type: String,
      enum: ["ALS", "BLS"],
      default: "BLS",
    },

    // 📊 Equipment & Supplies
    equipment: {
      defibrillator: { type: Boolean, default: false },
      ventilator: { type: Boolean, default: false },
      stretcher: { type: Boolean, default: true },
      oxygenCylinder: { type: Boolean, default: true },
      firstAidKit: { type: Boolean, default: true },
      suction: { type: Boolean, default: false },
    },

    // 📞 Contact Info
    contactNumber: {
      type: String,
      required: true,
    },

    // 📝 Notes
    notes: {
      type: String,
    },

    // ⏱️ Availability
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

export default mongoose.model("Ambulance", ambulanceSchema);
