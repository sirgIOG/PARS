import Incident from "../models/incident.js";
import { getIO } from "../services/socket.js";
import {
  classifyCategory,
  suggestAmbulanceType,
  suggestPriority,
} from "../services/categoryClassifier.js";

export const createCall = async (req, res) => {
  try {
    const {
      patientName,
      patientAge,
      patientSex,
      callerPhone,
      chiefComplaint,
      symptoms,
      location,
    } = req.body;

    if (!chiefComplaint || !location?.lat || !location?.lng) {
      return res
        .status(400)
        .json({ error: "Chief complaint and location are required" });
    }

    // Run the rule-based classifier so the dispatcher gets a category +
    // suggested priority/ambulance type the moment the call lands.
    const classification = classifyCategory({
      chiefComplaint,
      symptoms: symptoms || [],
      age: patientAge,
    });

    const incident = await Incident.create({
      patientName,
      patientAge,
      patientSex,
      callerPhone,
      chiefComplaint,
      symptoms: symptoms || [],
      location,
      category: classification.category,
      categoryConfidence: classification.confidence,
      categoryAlternatives: classification.alternatives,
      priority: suggestPriority(
        classification.category,
        classification.confidence
      ),
      ambulanceType: suggestAmbulanceType(classification.category),
    });

    const io = getIO();
    if (io) {
      io.emit("newCall", incident);
    }

    res.status(201).json(incident);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
