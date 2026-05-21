import express from "express";
import { authMiddleware, roleMiddleware } from "../middlewares/authMiddleware.js";
import {
  getQueue,
  getActiveIncidents,
  getHospitals,
  assignAmbulance,
  updateIncidentStatus,
  getActiveIncidentForAmbulance,
  getRecommendations,
  sendPreAlert,
  rerouteIncident,
  forceRescore,
  updateIncidentHospital,
} from "../controllers/dispatchController.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/queue", roleMiddleware("dispatcher", "admin"), getQueue);
router.get("/active", roleMiddleware("dispatcher", "admin"), getActiveIncidents);
router.get("/hospitals", roleMiddleware("dispatcher", "admin", "hospital"), getHospitals);
router.post("/assign", roleMiddleware("dispatcher", "admin"), assignAmbulance);
router.get(
  "/incidents/:id/recommendations",
  roleMiddleware("dispatcher", "admin"),
  getRecommendations
);
router.post(
  "/incidents/:id/pre-alert",
  roleMiddleware("dispatcher", "admin"),
  sendPreAlert
);
router.post(
  "/incidents/:id/reroute",
  roleMiddleware("dispatcher", "admin"),
  rerouteIncident
);
router.patch(
  "/incidents/:id/status",
  roleMiddleware("dispatcher", "admin", "paramedic", "driver", "hospital"),
  updateIncidentStatus
);

router.post("/force-rescore", roleMiddleware("dispatcher", "admin"), forceRescore);

router.patch(
  "/incidents/:id/hospital",
  roleMiddleware("dispatcher", "admin", "paramedic", "driver"),
  updateIncidentHospital
);

router.get(
  "/ambulances/:id/active",
  roleMiddleware("dispatcher", "admin", "paramedic", "driver"),
  getActiveIncidentForAmbulance
);

export default router;
