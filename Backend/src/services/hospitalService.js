import Hospital from "../models/hospital.js";
import { calculateDistanceKm, estimateEtaMinutes } from "../utils/geoUtils.js";

/**
 * Score & rank hospitals for an incident.
 *
 * Inputs:
 *   - incidentLocation: { lat, lng }
 *   - category: clinical category from the classifier
 *   - riskLevel: ESI level 1–5 from the ML model (1 = critical, 5 = non-urgent)
 *
 * Output: an array of recommendations sorted best-first, each with a
 * transparent reasons[] array so the dispatcher UI can explain *why* a
 * hospital was ranked above another.
 *
 * Scoring (lower = better):
 *   base   = ETA in minutes (driving time proxy)
 *   tier penalty   = (categoryTier - 1) * 6  → prefer specialty centers
 *   capability miss = +25 if hospital can't handle the category
 *   load penalty   = load * 8                → avoid the most crowded ER
 *   high-acuity bonus for ICU = -3 if ESI ≤ 2 and hospital has ICU
 */
export const rankHospitalsForIncident = async ({
  incidentLocation,
  category = "general",
  riskLevel = 3,
}) => {
  if (!incidentLocation?.lat || !incidentLocation?.lng) return [];

  const hospitals = await Hospital.find({ isActive: true });
  if (!hospitals.length) return [];

  const isHighAcuity = riskLevel <= 2;

  const scored = hospitals.map((h) => {
    const distanceKm = calculateDistanceKm(
      incidentLocation.lat,
      incidentLocation.lng,
      h.location.lat,
      h.location.lng
    );
    const etaMinutes = estimateEtaMinutes(distanceKm);

    const reasons = [];
    let score = etaMinutes; // base = travel time

    // Capability for the category
    const capable =
      h.categoryCapabilities?.[category] ??
      h.capabilities?.[category] ??
      category === "general";

    if (capable) {
      reasons.push(`Handles ${category} cases`);
    } else {
      score += 25;
      reasons.push(`No declared ${category} capability (+25 penalty)`);
    }

    // Per-category tier (lower is better)
    const tier = h.categoryTiers?.[category] ?? h.level ?? 3;
    if (tier) {
      const tierPenalty = (tier - 1) * 6;
      score += tierPenalty;
      if (tierPenalty > 0) {
        reasons.push(`Tier ${tier} for ${category} (+${tierPenalty})`);
      } else {
        reasons.push(`Tier 1 (definitive care) for ${category}`);
      }
    }

    // High-acuity ICU bonus
    if (isHighAcuity) {
      if (h.capabilities?.icu) {
        score -= 3;
        reasons.push("ICU available (high-acuity bonus)");
      } else {
        score += 12;
        reasons.push("No ICU (high-acuity penalty)");
      }
    }

    // Load penalty
    if (typeof h.load === "number") {
      const loadPenalty = h.load * 8;
      score += loadPenalty;
      if (h.load >= 0.7) {
        reasons.push(`High load (${Math.round(h.load * 100)}%)`);
      } else if (h.load <= 0.3) {
        reasons.push(`Low load (${Math.round(h.load * 100)}%)`);
      }
    }

    // Trauma bay availability for trauma cases
    if (category === "trauma" && h.capacity?.traumaBaysAvailable === 0) {
      score += 15;
      reasons.push("No trauma bays available (+15)");
    }

    // ETA reason always at the front
    reasons.unshift(`ETA ${etaMinutes} min (${distanceKm.toFixed(1)} km)`);

    return {
      hospitalId: h._id,
      name: h.name,
      hospital: h,
      distanceKm: Number(distanceKm.toFixed(2)),
      etaMinutes,
      score: Number(score.toFixed(1)),
      tier,
      reasons,
    };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored;
};

/**
 * Backward-compatible single-hospital selection used by patientService.
 */
export const selectHospital = async ({
  incidentLocation,
  riskLevel,
  category = "general",
}) => {
  const ranked = await rankHospitalsForIncident({
    incidentLocation,
    category,
    riskLevel,
  });
  if (!ranked.length) return null;
  const best = ranked[0];
  return {
    hospital: best.hospital,
    distanceKm: best.distanceKm,
    etaMinutes: best.etaMinutes,
    reasons: best.reasons,
    ranked,
  };
};
