import Incident from "../models/incident.js";
import Ambulance from "../models/ambulance.js";
import Hospital from "../models/hospital.js";
import {
  assignAmbulanceToIncident,
  rankAmbulancesForIncident,
  rerouteIncidentToHospital,
} from "../services/dispatchService.js";
import { rankHospitalsForIncident } from "../services/hospitalService.js";
import { getIO } from "../services/socket.js";

export const getQueue = async (req, res) => {
  try {
    const incidents = await Incident.find({ status: "new" })
      .sort({ createdAt: -1 })
      .populate("assignedAmbulance")
      .populate("assignedHospital");

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Returns all active hospitals so the dispatcher map can render them.
 */
export const getHospitals = async (req, res) => {
  try {
    const hospitals = await Hospital.find({ isActive: true }).sort({ name: 1 });
    res.json(hospitals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Returns all in-flight incidents (assigned but not yet handed over).
 * Used by the dispatcher UI's "In-Flight" panel.
 */
export const getActiveIncidents = async (req, res) => {
  try {
    const incidents = await Incident.find({
      status: { $in: ["dispatched", "en_route", "on_scene", "transporting", "at_hospital"] },
    })
      .sort({ createdAt: -1 })
      .populate("assignedAmbulance")
      .populate("assignedHospital")
      .populate("patient");

    res.json(incidents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const assignAmbulance = async (req, res) => {
  try {
    const {
      incidentId,
      priority,
      ambulanceType,
      ambulanceId,
      hospitalId,
      dispatcherNotes,
    } = req.body;

    if (!incidentId) {
      return res.status(400).json({ error: "Incident ID is required" });
    }

    const incident = await assignAmbulanceToIncident({
      incidentId,
      priority,
      ambulanceType,
      ambulanceId,
      hospitalId,
      dispatcherNotes,
    });

    const io = getIO();
    if (io) {
      io.emit("dispatchAssigned", incident);
    }

    res.json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Returns the ranked hospital recommendations for an incident in real time.
 * Used by the dispatcher UI before locking in an assignment.
 */
export const getRecommendations = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id);
    if (!incident) return res.status(404).json({ error: "Incident not found" });

    const hospitals = await rankHospitalsForIncident({
      incidentLocation: incident.location,
      category: incident.category || "general",
      riskLevel: 3,
    });

    const ambulances = await rankAmbulancesForIncident({
      incidentLocation: incident.location,
      ambulanceType: incident.ambulanceType,
    });

    res.json({
      incident: {
        _id: incident._id,
        category: incident.category,
        categoryConfidence: incident.categoryConfidence,
        categoryAlternatives: incident.categoryAlternatives,
        priority: incident.priority,
        ambulanceType: incident.ambulanceType,
      },
      hospitals: hospitals.slice(0, 5).map((h) => ({
        hospitalId: h.hospitalId,
        name: h.name,
        distanceKm: h.distanceKm,
        etaMinutes: h.etaMinutes,
        score: h.score,
        tier: h.tier,
        reasons: h.reasons,
      })),
      ambulances: ambulances.slice(0, 5).map((a) => ({
        ambulanceId: a.ambulance._id,
        code: a.ambulance.ambulanceId,
        numberPlate: a.ambulance.numberPlate,
        serviceLevel: a.ambulance.serviceLevel,
        distanceKm: a.distanceKm,
        etaMinutes: a.etaMinutes,
        reasons: a.reasons,
      })),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const updateIncidentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const allowedStatuses = [
      "dispatched",
      "en_route",
      "on_scene",
      "transporting",
      "at_hospital",
      "handover_complete",
      "closed",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const update = { status };
    if (status === "handover_complete") {
      update.handoverCompletedAt = new Date();
    }

    const incident = await Incident.findByIdAndUpdate(id, update, { new: true })
      .populate("assignedAmbulance")
      .populate("assignedHospital")
      .populate("patient");

    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }

    if (
      incident.assignedAmbulance &&
      ["handover_complete", "closed"].includes(status)
    ) {
      await Ambulance.findByIdAndUpdate(incident.assignedAmbulance._id, {
        status: "available",
      });
    }

    const io = getIO();
    if (io) {
      io.emit("incidentStatusUpdate", incident);
      if (status === "handover_complete") {
        io.emit("handoverComplete", incident);
      }
    }

    res.json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const getActiveIncidentForAmbulance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Ambulance ID is required" });
    }

    const incident = await Incident.findOne({
      assignedAmbulance: id,
      status: { $in: ["dispatched", "en_route", "on_scene", "transporting"] },
    })
      .sort({ updatedAt: -1 })
      .populate("assignedAmbulance")
      .populate("assignedHospital")
      .populate("patient");

    if (!incident) {
      return res.json(null);
    }

    res.json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Send a pre-alert to the assigned hospital. Broadcasts a `hospitalPreAlert`
 * socket event with patient/incident summary + suggested team activations.
 */
export const sendPreAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const incident = await Incident.findById(id)
      .populate("assignedAmbulance")
      .populate("assignedHospital")
      .populate("patient");

    if (!incident) return res.status(404).json({ error: "Incident not found" });
    if (!incident.assignedHospital) {
      return res.status(400).json({ error: "No hospital assigned" });
    }

    incident.preAlertSentAt = new Date();
    await incident.save();

    // Suggested team activation based on incident category.
    const teamSuggestions = [];
    const cat = incident.category;
    if (cat === "cardiac") teamSuggestions.push("cardiac team", "cath lab");
    if (cat === "stroke") teamSuggestions.push("stroke team", "CT scan");
    if (cat === "trauma")
      teamSuggestions.push("trauma team", "trauma bay", "blood bank");
    if (cat === "neuro") teamSuggestions.push("neuro team");
    if (cat === "respiratory")
      teamSuggestions.push("respiratory therapy", "ventilator");
    if (cat === "obstetric") teamSuggestions.push("L&D team", "NICU standby");

    const payload = {
      incident,
      patient: incident.patient || null,
      hospital: incident.assignedHospital,
      ambulance: incident.assignedAmbulance,
      etaMinutes: incident.etaMinutes,
      category: incident.category,
      teamSuggestions,
    };

    const io = getIO();
    if (io) io.emit("hospitalPreAlert", payload);

    res.json(payload);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

/**
 * Reroute an in-flight incident to a different hospital. Broadcasts
 * `incidentRerouted` so the crew + hospital pages can react in real time.
 */
export const rerouteIncident = async (req, res) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.body;

    const incident = await rerouteIncidentToHospital({
      incidentId: id,
      hospitalId,
    });

    const io = getIO();
    if (io) io.emit("incidentRerouted", incident);

    res.json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const forceRescore = async (req, res) => {
  try {
    const { recalculateRiskScores } = await import('../services/riskScheduler.js');
    await recalculateRiskScores();
    res.json({ ok: true, message: 'Rescore triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * PATCH /incidents/:id/hospital
 * Lets the ambulance crew switch destination hospital mid-run.
 * Updates the incident + the linked patient record. Broadcasts
 * incidentRerouted so the dispatcher + hospital pages update.
 */
export const updateIncidentHospital = async (req, res) => {
  try {
    const { id } = req.params;
    const { hospitalId } = req.body;

    if (!hospitalId) {
      return res.status(400).json({ error: 'Hospital ID is required' });
    }

    const incident = await Incident.findById(id).populate('patient');
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.assignedHospital = hospitalId;
    await incident.save();

    if (incident.patient) {
      await Patient.findByIdAndUpdate(incident.patient._id, {
        hospital: hospitalId,
      });
    }

    const updated = await Incident.findById(incident._id)
      .populate('assignedAmbulance')
      .populate('assignedHospital')
      .populate('patient')
      .populate('hospitalRecommendations.hospitalId');

    const io = getIO();
    if (io) io.emit('incidentRerouted', updated);

    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
