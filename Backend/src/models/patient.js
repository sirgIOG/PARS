import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    // 🧍 Basic Info
    name: {
      type: String,
      trim: true,
    },
    age: {
      type: Number,
      required: true,
      min: 0,
      max: 120,
    },

    sex: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },

    // 🧠 Medical History
    knownConditions: {
      hypertension: { type: Boolean, default: false },
      diabetes: { type: Boolean, default: false },
      cardiacHistory: { type: Boolean, default: false },
    },

    // 📝 Symptoms (can upgrade to array later)
    symptoms: {
      type: [String], // better than String
      default: [],
    },

    // ❤️ Vitals (latest snapshot)
    vitals: {
      systolicBP: Number,
      diastolicBP: Number,
      heartRate: Number,
      respiratoryRate: Number, // fixed spelling
      temperature: Number,
      painScore: { type: Number, min: 0, max: 10 },
      spo2: Number,
      recordedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // 📡 Data Source
    dataSource: {
      type: String,
      enum: ["manual", "device", "simulated"],
      default: "manual",
    },

    // 🧠 AI Prediction
    riskPrediction: {
      level: {
        type: Number,
        required: true, // from ML (1–5)
        min: 1,
        max: 5,
      },

      score: {
        type: Number, // probability/confidence
      },

      category: {
        type: String,
        enum: ["HIGH", "MEDIUM", "LOW"],
      },
    },

    // 🚑 Ambulance Info
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      required: false,
    },

    // 📞 Incident
    incident: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      required: false,
    },

    // 🏥 Hospital
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: false,
    },

    // 👨‍⚕️ Paramedic Notes
    paramedicNotes: String,

    // 🔔 Alert Status
    alertSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt & updatedAt automatically
  }
);

export default mongoose.model("Patient", patientSchema);