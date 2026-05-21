import Patient from '../models/patient.js';
import User from '../models/user.js';
import { handleVitals as handleVitalsService } from '../services/patientService.js';

// Create patient
export const createPatient = async (req, res) => {
    try {
        const patient = await Patient.create(req.body);
        res.status(201).json(patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all patients
export const getPatients = async (req, res) => {
    try {
        const patients = await Patient.find()
            .populate('hospital')
            .populate('ambulance')
            .populate('incident')
            .sort({ createdAt: -1 });
        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get patient by ID
export const getPatientById = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id)
            .populate('hospital')
            .populate('ambulance')
            .populate('incident');
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get patients assigned to the logged-in hospital
export const getHospitalPatients = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let hospitalId = null;
        if (user.role === 'admin') {
            hospitalId = req.query.hospitalId || null;
        } else {
            hospitalId = user.hospitalId;
        }

        const query = hospitalId ? { hospital: hospitalId } : {};

        const patients = await Patient.find(query)
            .populate('hospital')
            .populate('ambulance')
            .populate('incident')
            .sort({ createdAt: -1 });

        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get a single hospital-assigned patient by ID
export const getHospitalPatientById = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let hospitalId = null;
        if (user.role === 'admin') {
            hospitalId = req.query.hospitalId || null;
        } else {
            hospitalId = user.hospitalId;
        }

        const patient = await Patient.findById(req.params.id)
            .populate('hospital')
            .populate('ambulance')
            .populate('incident');

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        if (hospitalId && patient.hospital?._id?.toString() !== hospitalId.toString()) {
            return res.status(403).json({ error: 'Not authorized for this patient' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update patient
export const updatePatient = async (req, res) => {
    try {
        const patient = await Patient.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json(patient);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete patient
export const deletePatient = async (req, res) => {
    try {
        const patient = await Patient.findByIdAndDelete(req.params.id);
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }
        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Handle vitals submission
export const handleVitals = async (req, res) => {
    try {
        const patient = await handleVitalsService(req.body);
        res.status(201).json(patient);
    } catch (error) {
        console.error('Error handling vitals:', error);
        res.status(400).json({ error: error.message });
    }
};
