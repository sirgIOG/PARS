import express from 'express';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import {
    createAmbulance,
    getAmbulances,
    getAvailableAmbulances,
    getAmbulanceById,
    updateAmbulance,
    updateAmbulanceLocation,
    updateAmbulanceStatus,
    deleteAmbulance
} from '../controllers/ambulanceController.js';

const router = express.Router();

// Public route for available ambulances
router.get('/available', getAvailableAmbulances);

// Protected routes
router.use(authMiddleware);

// Get all ambulances
router.get('/', getAmbulances);

// Get ambulance by ID
router.get('/:id', getAmbulanceById);

// Create ambulance
router.post('/', createAmbulance);

// Update ambulance
router.put('/:id', updateAmbulance);

// Update ambulance location
router.patch('/:id/location', updateAmbulanceLocation);

// Update ambulance status
router.patch('/:id/status', updateAmbulanceStatus);

// Delete ambulance
router.delete('/:id', deleteAmbulance);

export default router;
