import Ambulance from '../models/ambulance.js';

// Create ambulance
export const createAmbulance = async (req, res) => {
    try {
        const ambulance = await Ambulance.create(req.body);
        res.status(201).json(ambulance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Get all ambulances
export const getAmbulances = async (req, res) => {
    try {
        const ambulances = await Ambulance.find().sort({ createdAt: -1 });
        res.json(ambulances);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get available ambulances only
export const getAvailableAmbulances = async (req, res) => {
    try {
        const ambulances = await Ambulance.find({ 
            status: "available",
            isActive: true
        });
        res.json(ambulances);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get ambulance by ID
export const getAmbulanceById = async (req, res) => {
    try {
        const ambulance = await Ambulance.findById(req.params.id);
        if (!ambulance) {
            return res.status(404).json({ error: 'Ambulance not found' });
        }
        res.json(ambulance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update ambulance
export const updateAmbulance = async (req, res) => {
    try {
        const ambulance = await Ambulance.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!ambulance) {
            return res.status(404).json({ error: 'Ambulance not found' });
        }
        res.json(ambulance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update ambulance location (for real-time tracking)
export const updateAmbulanceLocation = async (req, res) => {
    try {
        const { lat, lng } = req.body;
        const ambulance = await Ambulance.findByIdAndUpdate(
            req.params.id,
            {
                'currentLocation.lat': lat,
                'currentLocation.lng': lng,
                'currentLocation.lastUpdated': new Date()
            },
            { new: true }
        );
        if (!ambulance) {
            return res.status(404).json({ error: 'Ambulance not found' });
        }
        res.json(ambulance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Update ambulance status
export const updateAmbulanceStatus = async (req, res) => {
    try {
        const { status } = req.body;
        if (!['available', 'on-duty', 'maintenance', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const ambulance = await Ambulance.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );
        if (!ambulance) {
            return res.status(404).json({ error: 'Ambulance not found' });
        }
        res.json(ambulance);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete ambulance
export const deleteAmbulance = async (req, res) => {
    try {
        const ambulance = await Ambulance.findByIdAndDelete(req.params.id);
        if (!ambulance) {
            return res.status(404).json({ error: 'Ambulance not found' });
        }
        res.json({ message: 'Ambulance deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
