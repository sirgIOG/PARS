import express from 'express';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import { createPatient, getPatients, getPatientById, updatePatient, deletePatient, handleVitals, getHospitalPatients, getHospitalPatientById } from '../controllers/patientController.js';

const router = express.Router();

// Public route for vitals submission (from ambulance)
router.post('/vitals', handleVitals);

// Protected routes
router.use(authMiddleware);

// Get all patients
router.get('/', getPatients);

// Hospital-scoped patients
router.get('/hospital', roleMiddleware('hospital', 'admin'), getHospitalPatients);
router.get('/hospital/:id', roleMiddleware('hospital', 'admin'), getHospitalPatientById);

// Get patient by ID
router.get('/:id', getPatientById);

// Update patient
router.put('/:id', updatePatient);

// Delete patient
router.delete('/:id', deletePatient);

// Create patient
router.post('/', createPatient);

export default router;
