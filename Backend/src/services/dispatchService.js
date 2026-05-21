import Ambulance from "../models/ambulance.js";
import Incident from "../models/incident.js";
import { calculateDistanceKm, estimateEtaMinutes } from "../utils/geoUtils.js";
import { rankHospitalsForIncident } from "./hospitalService.js";

const selectNearestAmbulance = (ambulances, incidentLocation) => {
  if (!incidentLocation?.lat || !incidentLocation?.lng) return ambulances[0];

  let best = ambulances[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ambulance of ambulances) {
    const { lat, lng } = ambulance.currentLocation || {};
    if (lat == null || lng == null) continue;

    const distance = calculateDistanceKm(
      incidentLocation.lat,
      incidentLocation.lng,
      lat,
      lng
    );

    if (distance < bestDistance) {
      bestDistance = distance;
      best = ambulance;
    }
  }

  return best;
};

/**
 * Rank ambulances for an incident, returning a top-N with reasons.
 * Used by the dispatcher UI to show *why* a unit was suggested.
 */
export const rankAmbulancesForIncident = async ({
  incidentLocation,
  ambulanceType,
}) => {
  const query = { status: "available", isActive: true };
  if (ambulanceType) query.serviceLevel = ambulanceType;

  const ambulances = await Ambulance.find(query);
  if (!ambulances.length) return [];

  const ranked = ambulances.map((a) => {
    const distanceKm =
      a.currentLocation?.lat != null && a.currentLocation?.lng != null
        ? calculateDistanceKm(
            incidentLocation.lat,
            incidentLocation.lng,
            a.currentLocation.lat,
            a.currentLocation.lng
          )
        : null;

    const etaMinutes =
      distanceKm != null ? estimateEtaMinutes(distanceKm) : null;
    const reasons = [];
    if (distanceKm != null) {
      reasons.push(`${distanceKm.toFixed(1)} km away (~${etaMinutes} min)`);
    } else {
      reasons.push("Last known location unavailable");
    }
    reasons.push(`${a.serviceLevel} unit`);
    if (a.equipment?.defibrillator) reasons.push("Defibrillator");
    if (a.equipment?.ventilator) reasons.push("Ventilator");

    return {
      ambulance: a,
      distanceKm,
      etaMinutes,
      reasons,
      score: distanceKm != null ? distanceKm : 9999,
    };
  });

  ranked.sort((a, b) => a.score - b.score);
  return ranked;
};

export const assignAmbulanceToIncident = async ({
  incidentId,
  priority,
  ambulanceType,
  ambulanceId,
  hospitalId,
  dispatcherNotes,
}) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    throw new Error("Incident not found");
  }

  let ambulance = null;

  if (ambulanceId) {
    ambulance = await Ambulance.findOne({
      _id: ambulanceId,
      status: "available",
      isActive: true,
    });
  }

  if (!ambulance) {
    const query = {
      status: "available",
      isActive: true,
    };

    if (ambulanceType) {
      query.serviceLevel = ambulanceType;
    }

    const available = await Ambulance.find(query);
    if (!available.length) {
      throw new Error("No available ambulances");
    }

    ambulance = selectNearestAmbulance(available, incident.location);
  }

  // Compute ranked hospital recommendations (category-aware) so the
  // dispatcher can see/override and the UI can render the top-3 list.
  const ranked = await rankHospitalsForIncident({
    incidentLocation: incident.location,
    category: incident.category || "general",
    riskLevel: 3, // ESI not yet known at assignment; refined post-vitals
  });

  let chosenHospitalId = hospitalId;
  if (!chosenHospitalId && ranked.length) {
    chosenHospitalId = ranked[0].hospitalId;
  }

  incident.priority = priority || incident.priority;
  incident.ambulanceType = ambulanceType || incident.ambulanceType;
  incident.assignedAmbulance = ambulance._id;
  if (chosenHospitalId) {
    incident.assignedHospital = chosenHospitalId;
  }
  incident.hospitalRecommendations = ranked.slice(0, 5).map((r) => ({
    hospitalId: r.hospitalId,
    name: r.name,
    distanceKm: r.distanceKm,
    etaMinutes: r.etaMinutes,
    score: r.score,
    reasons: r.reasons,
    tier: r.tier,
  }));
  incident.dispatcherNotes = dispatcherNotes || incident.dispatcherNotes;
  incident.status = "dispatched";

  await incident.save();

  ambulance.status = "on-duty";
  await ambulance.save();

  return Incident.findById(incident._id)
    .populate("assignedAmbulance")
    .populate("assignedHospital");
};

/**
 * Reroute an existing incident to a different hospital.
 * Returns the populated incident so callers can broadcast it.
 */
export const rerouteIncidentToHospital = async ({ incidentId, hospitalId }) => {
  const incident = await Incident.findById(incidentId);
  if (!incident) throw new Error("Incident not found");
  if (!hospitalId) throw new Error("hospitalId is required");

  incident.assignedHospital = hospitalId;
  await incident.save();

  return Incident.findById(incident._id)
    .populate("assignedAmbulance")
    .populate("assignedHospital");
};
