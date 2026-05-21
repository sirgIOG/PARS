import mongoose from "mongoose";

const incidentSchema = new mongoose.Schema(
  {
    patientName: { type: String, trim: true },
    patientAge: { type: Number, min: 0, max: 120 },
    patientSex: { type: String, enum: ["Male", "Female", "Other"] },
    callerPhone: { type: String, trim: true },
    chiefComplaint: { type: String, required: true, trim: true },
    symptoms: { type: [String], default: [] },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, default: "" },
    },
    priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
    },
    ambulanceType: {
      type: String,
      enum: ["ALS", "BLS"],
      default: "BLS",
    },

    // NEW — clinical category used for hospital routing.
    // Populated by the rule-based classifier when the call is created;
    // dispatcher can override.
    category: {
      type: String,
      enum: [
        "cardiac",
        "stroke",
        "trauma",
        "neuro",
        "respiratory",
        "obstetric",
        "pediatric",
        "burn",
        "general",
      ],
      default: "general",
    },
    // Confidence (0–1) the classifier had in the chosen category.
    categoryConfidence: { type: Number, min: 0, max: 1, default: 0.5 },
    // Other categories the classifier considered (for transparency).
    categoryAlternatives: { type: [String], default: [] },

    status: {
      type: String,
      enum: [
        "new",
        "dispatched",
        "en_route",
        "on_scene",
        "transporting",
        "at_hospital",
        "handover_complete",
        "closed",
      ],
      default: "new",
    },
    assignedAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
    },
    assignedHospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
    // NEW — alternative hospital recommendations cached at assignment time
    // so the dispatcher can see the ranked list and one-click reroute.
    hospitalRecommendations: {
      type: [
        {
          hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital" },
          name: String,
          distanceKm: Number,
          etaMinutes: Number,
          score: Number,
          reasons: [String],
          tier: Number,
        },
      ],
      default: [],
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
    dispatcherNotes: { type: String, default: "" },
    etaMinutes: { type: Number },
    etaUpdatedAt: { type: Date },

    // NEW — pre-alert + handover audit trail.
    preAlertSentAt: { type: Date },
    handoverCompletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Incident", incidentSchema);
