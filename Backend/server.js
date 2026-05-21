import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import 'dotenv/config';
import http from 'http';
import connectDB from './src/config/db.js';
import { initSocket } from './src/services/socket.js';
import patientRoutes from './src/routes/patientRoutes.js';
import ambulanceRoutes from './src/routes/ambulanceRoutes.js';
import authRoutes from './src/routes/authRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import callRoutes from './src/routes/callRoutes.js';
import dispatchRoutes from './src/routes/dispatchRoutes.js';
import { recalculateRiskScores, updateIncidentEtas } from './src/services/riskScheduler.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

const checkDBConnection = async () => {
    try {
        await connectDB(); 
        startSchedulers();
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1); 
    }
}

let riskTimer = null;
let etaTimer = null;
let riskRunning = false;
let etaRunning = false;

const startSchedulers = () => {
    if (riskTimer || etaTimer) return;

    riskTimer = setInterval(async () => {
        if (riskRunning) return;
        riskRunning = true;
        try {
            await recalculateRiskScores();
        } catch (error) {
            console.error('Risk scheduler error:', error.message);
        } finally {
            riskRunning = false;
        }
    }, 120000);

    etaTimer = setInterval(async () => {
        if (etaRunning) return;
        etaRunning = true;
        try {
            await updateIncidentEtas();
        } catch (error) {
            console.error('ETA scheduler error:', error.message);
        } finally {
            etaRunning = false;
        }
    }, 30000);
};

checkDBConnection();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/dispatch', dispatchRoutes);

const PORT = process.env.PORT || 3001;

app.get('/test', (req, res) => {
    res.send('API is working!');
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});