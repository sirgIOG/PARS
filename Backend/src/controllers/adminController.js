import Patient from '../models/patient.js';
import Ambulance from '../models/ambulance.js';
import Hospital from '../models/hospital.js';
import User from '../models/user.js';
import { hashPassword } from '../utils/authUtils.js';

/**
 * Get dashboard statistics
 */
export const getStats = async (req, res) => {
    try {
        const [
            totalPatients,
            totalAmbulances,
            availableAmbulances,
            onDutyAmbulances,
            maintenanceAmbulances,
            highRiskPatients,
            mediumRiskPatients,
            lowRiskPatients
        ] = await Promise.all([
            Patient.countDocuments(),
            Ambulance.countDocuments(),
            Ambulance.countDocuments({ status: 'available', isActive: true }),
            Ambulance.countDocuments({ status: 'on-duty', isActive: true }),
            Ambulance.countDocuments({ status: 'maintenance', isActive: true }),
            Patient.countDocuments({ 'riskPrediction.category': 'HIGH' }),
            Patient.countDocuments({ 'riskPrediction.category': 'MEDIUM' }),
            Patient.countDocuments({ 'riskPrediction.category': 'LOW' })
        ]);

        res.json({
            totalPatients,
            highRiskCount: highRiskPatients,
            mediumRiskCount: mediumRiskPatients,
            lowRiskCount: lowRiskPatients,
            totalAmbulances,
            availableAmbulances,
            onDutyAmbulances,
            maintenanceAmbulances
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get ambulance availability details grouped by status
 */
export const getAmbulances = async (req, res) => {
    try {
        const ambulances = await Ambulance.find();

        const grouped = {
            available: [],
            onDuty: [],
            maintenance: []
        };

        ambulances.forEach(amb => {
            const ambulanceData = {
                _id: amb._id,
                ambulanceId: amb.ambulanceId,
                vehicleDetails: {
                    numberPlate: amb.vehicleDetails?.numberPlate,
                    type: amb.vehicleDetails?.type,
                    model: amb.vehicleDetails?.model
                },
                driverDetails: {
                    name: amb.driverDetails?.name,
                    contact: amb.driverDetails?.contact,
                    license: amb.driverDetails?.license
                },
                status: amb.status,
                currentLocation: amb.currentLocation,
                equipmentList: amb.equipmentList,
                maintenanceNotes: amb.maintenanceNotes
            };

            if (amb.status === 'available') {
                grouped.available.push(ambulanceData);
            } else if (amb.status === 'on-duty') {
                grouped.onDuty.push(ambulanceData);
            } else if (amb.status === 'maintenance') {
                grouped.maintenance.push(ambulanceData);
            }
        });

        res.json(grouped);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get all patients with full details
 */
export const getPatients = async (req, res) => {
    try {
        const patients = await Patient.find()
            .populate('ambulance', 'ambulanceId vehicleDetails.numberPlate driverDetails.name')
            .sort({ createdAt: -1 });

        res.json(patients);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get patient by ID with full details
 */
export const getPatientById = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id)
            .populate('ambulance');

        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        res.json(patient);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get ambulance status analytics
 */
export const getAmbulanceStatusAnalytics = async (req, res) => {
    try {
        const ambulances = await Ambulance.find();

        const stats = {
            available: ambulances.filter(a => a.status === 'available').length,
            onDuty: ambulances.filter(a => a.status === 'on-duty').length,
            maintenance: ambulances.filter(a => a.status === 'maintenance').length,
            total: ambulances.length
        };

        const availability = ambulances.length > 0
            ? ((stats.available / ambulances.length) * 100).toFixed(1)
            : 0;

        res.json({
            ...stats,
            availabilityPercentage: availability
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Get risk distribution analytics
 */
export const getRiskDistributionAnalytics = async (req, res) => {
    try {
        const distribution = await Patient.aggregate([
            {
                $group: {
                    _id: '$riskPrediction.category',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            HIGH: distribution.find(d => d._id === 'HIGH')?.count || 0,
            MEDIUM: distribution.find(d => d._id === 'MEDIUM')?.count || 0,
            LOW: distribution.find(d => d._id === 'LOW')?.count || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * Admin: Register hospital + hospital login in one step
 */
export const createHospitalWithAccount = async (req, res) => {
    try {
        const {
            hospital,
            account
        } = req.body;

        if (!hospital?.name || !hospital?.location?.lat || !hospital?.location?.lng) {
            return res.status(400).json({ error: 'Hospital name and location are required' });
        }

        if (!account?.name || !account?.email || !account?.password) {
            return res.status(400).json({ error: 'Account name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email: account.email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const newHospital = await Hospital.create({
            name: hospital.name,
            location: hospital.location,
            capabilities: hospital.capabilities || {},
            level: hospital.level,
            capacity: hospital.capacity || {},
            isActive: hospital.isActive !== false
        });

        try {
            const hashedPassword = await hashPassword(account.password);
            const user = await User.create({
                name: account.name,
                email: account.email,
                password: hashedPassword,
                role: 'hospital',
                phone: account.phone || '',
                hospitalId: newHospital._id,
                isVerified: true
            });

            res.status(201).json({
                hospital: newHospital,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    hospitalId: user.hospitalId
                }
            });
        } catch (userError) {
            await Hospital.findByIdAndDelete(newHospital._id);
            throw userError;
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

/**
 * Admin: Register ambulance + ambulance login in one step
 */
export const createAmbulanceWithAccount = async (req, res) => {
    try {
        const { ambulance, account } = req.body;

        if (!ambulance?.ambulanceId || !ambulance?.numberPlate) {
            return res.status(400).json({ error: 'Ambulance ID and number plate are required' });
        }

        if (!ambulance?.driver?.name || !ambulance?.driver?.phone || !ambulance?.driver?.licenseNumber) {
            return res.status(400).json({ error: 'Driver details are required' });
        }

        if (!ambulance?.vehicle?.model) {
            return res.status(400).json({ error: 'Vehicle model is required' });
        }

        if (!ambulance?.contactNumber) {
            return res.status(400).json({ error: 'Contact number is required' });
        }

        if (!account?.name || !account?.email || !account?.password) {
            return res.status(400).json({ error: 'Account name, email, and password are required' });
        }

        const existingUser = await User.findOne({ email: account.email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        const newAmbulance = await Ambulance.create({
            ambulanceId: ambulance.ambulanceId,
            numberPlate: ambulance.numberPlate,
            driver: ambulance.driver,
            vehicle: ambulance.vehicle,
            currentLocation: ambulance.currentLocation || {},
            status: ambulance.status || 'available',
            serviceLevel: ambulance.serviceLevel || 'BLS',
            equipment: ambulance.equipment || {},
            contactNumber: ambulance.contactNumber,
            notes: ambulance.notes || '',
            isActive: ambulance.isActive !== false
        });

        try {
            const hashedPassword = await hashPassword(account.password);
            const user = await User.create({
                name: account.name,
                email: account.email,
                password: hashedPassword,
                role: account.role === 'driver' ? 'driver' : 'paramedic',
                phone: account.phone || '',
                ambulanceId: newAmbulance._id,
                isVerified: true
            });

            res.status(201).json({
                ambulance: newAmbulance,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    ambulanceId: user.ambulanceId
                }
            });
        } catch (userError) {
            await Ambulance.findByIdAndDelete(newAmbulance._id);
            throw userError;
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
