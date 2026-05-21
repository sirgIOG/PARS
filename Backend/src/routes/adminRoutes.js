import express from 'express';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import {
    getStats,
    getAmbulances,
    getPatients,
    getPatientById,
    getAmbulanceStatusAnalytics,
    getRiskDistributionAnalytics,
    createHospitalWithAccount,
    createAmbulanceWithAccount
} from '../controllers/adminController.js';

const router = express.Router();

// Protect all admin routes
router.use(authMiddleware);

// Admin-only registration
router.post('/hospitals/register', roleMiddleware('admin'), createHospitalWithAccount);
router.post('/ambulances/register', roleMiddleware('admin'), createAmbulanceWithAccount);

// Admin + hospital access
router.use(roleMiddleware('admin', 'hospital'));

// Dashboard statistics
router.get('/stats', getStats);

// Ambulance management
router.get('/ambulances', getAmbulances);

// Patient management
router.get('/patients', getPatients);
router.get('/patients/:id', getPatientById);

// Analytics
router.get('/analytics/ambulance-status', getAmbulanceStatusAnalytics);
router.get('/analytics/risk-distribution', getRiskDistributionAnalytics);

export default router;
