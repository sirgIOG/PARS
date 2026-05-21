import mongoose from "mongoose";

/**
 * Hospital model — extended for category-aware routing.
 *
 * `categoryCapabilities` is the new field used by hospitalService.selectHospital
 * to match incidents to the right facility (cardiac → PCI hospital, stroke →
 * stroke unit, trauma → level 1 trauma center, etc.).
 *
 * `categoryTiers` lets a hospital declare *how good* it is at a given category
 * (1 = best / definitive care, 3 = capable but limited). The router prefers
 * lower tiers for higher acuity.
 */
const hospitalSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, default: "" },
    },

    // Legacy boolean capability flags (kept for backward compatibility with
    // existing seed/admin code).
    capabilities: {
      trauma: { type: Boolean, default: false },
      cardiac: { type: Boolean, default: false },
      pediatric: { type: Boolean, default: false },
      neurology: { type: Boolean, default: false },
      icu: { type: Boolean, default: true },
    },

    // NEW — fine-grained category capability flags consumed by the router.
    // Add categories as needed; the router treats unknown categories as
    // "any hospital can handle it" (graceful degradation).
    categoryCapabilities: {
      cardiac: { type: Boolean, default: false },     // PCI / cath lab
      stroke: { type: Boolean, default: false },       // stroke unit / thrombolysis
      trauma: { type: Boolean, default: false },       // trauma bay / OR ready
      neuro: { type: Boolean, default: false },        // neurology / neurosurgery
      respiratory: { type: Boolean, default: true },   // most hospitals can handle
      obstetric: { type: Boolean, default: false },    // L&D, OB emergencies
      pediatric: { type: Boolean, default: false },
      burn: { type: Boolean, default: false },
      general: { type: Boolean, default: true },       // catch-all
    },

    // NEW — per-category tier (1 = definitive care, 5 = limited).
    // If a category is missing from this map the router falls back to
    // the hospital's overall `level`.
    categoryTiers: {
      cardiac: { type: Number, min: 1, max: 5 },
      stroke: { type: Number, min: 1, max: 5 },
      trauma: { type: Number, min: 1, max: 5 },
      neuro: { type: Number, min: 1, max: 5 },
      respiratory: { type: Number, min: 1, max: 5 },
      obstetric: { type: Number, min: 1, max: 5 },
      pediatric: { type: Number, min: 1, max: 5 },
      burn: { type: Number, min: 1, max: 5 },
      general: { type: Number, min: 1, max: 5 },
    },

    // Overall trauma-center / facility tier (1 = highest, 5 = lowest).
    level: {
      type: Number,
      min: 1,
      max: 5,
    },

    // Live capacity snapshot — updated by the mock HIS layer.
    capacity: {
      erBeds: { type: Number, default: 20 },
      icuBeds: { type: Number, default: 6 },
      erBedsAvailable: { type: Number, default: 20 },
      icuBedsAvailable: { type: Number, default: 6 },
      traumaBaysAvailable: { type: Number, default: 2 },
    },

    // NEW — current load (0–1). Higher means more crowded; the router
    // adds a small penalty so a slightly farther but less-loaded hospital
    // can win when severity is moderate.
    load: { type: Number, min: 0, max: 1, default: 0.3 },

    // NEW — what specialty teams are currently on-call / activatable.
    // The pre-alert flow surfaces a *suggested* activation list to the
    // hospital page based on the incident category.
    teamsOnCall: {
      cardiac: { type: Boolean, default: false },
      stroke: { type: Boolean, default: false },
      trauma: { type: Boolean, default: false },
      neuro: { type: Boolean, default: false },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Hospital", hospitalSchema);
