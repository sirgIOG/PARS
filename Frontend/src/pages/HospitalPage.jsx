import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { calculateDistance, calculateETA, formatDistance, HOSPITAL_LOCATION } from '../utils/locationUtils.js';
import '../styles/HospitalPage.css';

const CATEGORY_COLORS = {
    cardiac: '#e63946',
    stroke: '#9d4edd',
    trauma: '#f4a261',
    neuro: '#7b61ff',
    respiratory: '#2a9d8f',
    obstetric: '#ef476f',
    pediatric: '#ffb703',
    burn: '#fb5607',
    general: '#6c757d',
};

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const HospitalPage = () => {
    const [socket, setSocket] = useState(null);
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [ambulanceLocations, setAmbulanceLocations] = useState({});
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [filterRisk, setFilterRisk] = useState('ALL');
    const [hospitalLocation] = useState(HOSPITAL_LOCATION);
    const [preAlerts, setPreAlerts] = useState([]);
    const [liveVitalsByAmbulance, setLiveVitalsByAmbulance] = useState({});
    const [hospitalId] = useState(() => {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        return user.hospitalId || null;
    });

    // Fetch existing patients on mount
    useEffect(() => {
        const fetchInitialPatients = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API}/api/patients`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setPatients(data);
                }
            } catch (error) {
                console.error('Error fetching patients:', error);
            }
        };
        fetchInitialPatients();
    }, []);

    useEffect(() => {
        // Initialize WebSocket connection
        const newSocket = io(API, {
            transports: ['polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
            console.log('Hospital connected to server');
            setConnectionStatus('Connected');
        });

        newSocket.on('disconnect', () => {
            setConnectionStatus('Disconnected');
        });

        // Receive patient updates
        newSocket.on('patientUpdate', (patient) => {
            if (hospitalId && patient?.hospital?._id !== hospitalId) {
                return;
            }
            setPatients(prev => {
                const index = prev.findIndex(p => p._id === patient._id);
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = patient;
                    return updated;
                }
                return [patient, ...prev];
            });
        });

        // Receive critical alerts
        newSocket.on('criticalAlert', (patient) => {
            if (hospitalId && patient?.hospital?._id !== hospitalId) {
                return;
            }
            console.warn(' CRITICAL ALERT:', patient);
            alert(` CRITICAL ALERT: Patient ${patient._id} - Risk Level: HIGH`);
            setPatients(prev => {
                const index = prev.findIndex(p => p._id === patient._id);
                if (index > -1) {
                    const updated = [...prev];
                    updated[index] = patient;
                    return updated;
                }
                return [patient, ...prev];
            });
        });

        newSocket.on('hospitalPreAlert', (payload) => {
            if (hospitalId && payload?.hospital?._id !== hospitalId) {
                return;
            }
            setPreAlerts(prev => {
                const without = prev.filter(p => p.incident?._id !== payload.incident?._id);
                return [payload, ...without].slice(0, 5);
            });
        });

        newSocket.on('incidentStatusUpdate', (incident) => {
            if (['handover_complete', 'closed'].includes(incident.status)) {
                setPreAlerts(prev => prev.filter(p => p.incident?._id !== incident._id));
            } else {
                setPreAlerts(prev =>
                    prev.map(p =>
                        p.incident?._id === incident._id ? { ...p, incident } : p
                    )
                );
            }
        });

        newSocket.on('incidentRerouted', (incident) => {
            // If we lose the patient (rerouted away), drop the pre-alert.
            if (hospitalId && incident.assignedHospital?._id !== hospitalId) {
                setPreAlerts(prev => prev.filter(p => p.incident?._id !== incident._id));
            }
        });

        newSocket.on('liveVitals', (payload) => {
            if (hospitalId && payload?.hospitalId && payload.hospitalId !== hospitalId) {
                return;
            }
            if (!payload?.ambulanceId) return;
            setLiveVitalsByAmbulance(prev => ({
                ...prev,
                [payload.ambulanceId]: payload
            }));
        });

        // Receive ambulance location updates
        newSocket.on('ambulanceLocationUpdate', (data) => {
            const { ambulanceId, lat, lng } = data;
            setAmbulanceLocations(prev => ({
                ...prev,
                [ambulanceId]: { lat, lng }
            }));
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    // Filter patients by risk level
    useEffect(() => {
        let next = patients;
        if (hospitalId) {
            next = next.filter(p => p.hospital?._id === hospitalId);
        }
        if (filterRisk !== 'ALL') {
            next = next.filter(p => p.riskPrediction?.category === filterRisk);
        }
        setFilteredPatients(next);
    }, [patients, filterRisk, hospitalId]);

    const getRiskColor = (riskLevel) => {
        switch (riskLevel) {
            case 'HIGH':
                return '#ff4444';
            case 'MEDIUM':
                return '#ffa500';
            case 'LOW':
                return '#44ff44';
            default:
                return '#999';
        }
    };

    const handleAcceptHandover = async (incidentId) => {
        if (!incidentId) return;
        const token = localStorage.getItem('token');
        try {
            await fetch(`${API}/api/dispatch/incidents/${incidentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'handover_complete' }),
            });
            setPreAlerts(prev => prev.filter(p => p.incident?._id !== incidentId));
        } catch (err) {
            console.error('handover failed', err);
        }
    };

    const handleAcknowledge = async (incidentId) => {
        if (!incidentId) return;
        const token = localStorage.getItem('token');
        try {
            await fetch(`${API}/api/dispatch/incidents/${incidentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: 'at_hospital' }),
            });
        } catch (err) {
            console.error('acknowledge failed', err);
        }
    };

    const getAmbulanceETA = (ambulanceId) => {
        if (!ambulanceId || !ambulanceLocations[ambulanceId]) {
            return null;
        }

        const location = ambulanceLocations[ambulanceId];
        const distance = calculateDistance(
            location.lat,
            location.lng,
            hospitalLocation.lat,
            hospitalLocation.lng
        );

        const eta = calculateETA(distance);
        const formattedDistance = formatDistance(distance);

        return { distance: formattedDistance, eta, lat: location.lat, lng: location.lng };
    };

    return (
        <div className="hospital-page">
            <header className="hospital-header">
                <h1> Hospital Dashboard</h1>
                <div className={`connection-status ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}>
                    {connectionStatus}
                </div>
            </header>

            <div className="controls">
                <div className="filter-section">
                    <label>Filter by Risk Level:</label>
                    <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
                        <option value="ALL">All Patients</option>
                        <option value="HIGH">High Risk</option>
                        <option value="MEDIUM">Medium Risk</option>
                        <option value="LOW">Low Risk</option>
                    </select>
                </div>
                <div className="patient-count">
                    Total Patients: <strong>{filteredPatients.length}</strong>
                </div>
            </div>

            {preAlerts.length > 0 && (
                <div className="prealert-section">
                    <h3>🚨 Incoming Pre-Alerts</h3>
                    <div className="prealert-grid">
                        {preAlerts.map((alert) => {
                            const cat = alert.category || alert.incident?.category;
                            const catColor = CATEGORY_COLORS[cat] || '#6c757d';
                            const incidentId = alert.incident?._id;
                            return (
                                <div key={incidentId} className="prealert-card">
                                    <div
                                        className="prealert-stripe"
                                        style={{ background: catColor }}
                                    />
                                    <div className="prealert-header">
                                        <strong>Incident {incidentId?.slice(-6)}</strong>
                                        {cat && (
                                            <span
                                                className="prealert-category"
                                                style={{ background: catColor }}
                                            >
                                                {cat}
                                            </span>
                                        )}
                                    </div>
                                    <p><strong>ETA:</strong> {alert.etaMinutes ? `${alert.etaMinutes} mins` : 'Calculating'}</p>
                                    <p><strong>Unit:</strong> {alert.ambulance?.ambulanceId || 'TBD'}</p>
                                    <p><strong>Complaint:</strong> {alert.incident?.chiefComplaint || 'N/A'}</p>
                                    {alert.patient?.age && (
                                        <p><strong>Patient:</strong> {alert.patient.age}y {alert.patient.sex}</p>
                                    )}
                                    {alert.teamSuggestions?.length > 0 && (
                                        <div className="team-activations">
                                            <strong>Activate:</strong>
                                            <div className="team-pills">
                                                {alert.teamSuggestions.map((t, i) => (
                                                    <span key={i} className="team-pill">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="prealert-actions">
                                        <button
                                            className="prealert-btn primary"
                                            onClick={() => handleAcceptHandover(incidentId)}
                                        >
                                            Accept Handover
                                        </button>
                                        <button
                                            className="prealert-btn"
                                            onClick={() => handleAcknowledge(incidentId)}
                                        >
                                            Acknowledge
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="patients-container">
                {filteredPatients.length === 0 ? (
                    <div className="no-patients">
                        No patients to display
                    </div>
                ) : (
                    <div className="patients-grid">
                        {filteredPatients.map((patient) => (
                            <div key={patient._id} className="patient-card">
                                <div className="patient-header">
                                    <h3>Patient ID: {patient._id?.slice(-6)}</h3>
                                    <div
                                        className="risk-badge"
                                        style={{ backgroundColor: getRiskColor(patient.riskPrediction?.category) }}
                                    >
                                        {patient.riskPrediction?.category || 'UNKNOWN'}
                                    </div>
                                </div>

                                <div className="patient-info">
                                    <p><strong>Age:</strong> {patient.age}</p>
                                    <p><strong>Sex:</strong> {patient.sex}</p>
                                    {patient.symptoms && patient.symptoms.length > 0 && (
                                        <p><strong>Symptoms:</strong> {patient.symptoms.join(', ')}</p>
                                    )}
                                </div>

                                {patient.ambulance && (
                                    <div className="ambulance-info-section">
                                        <h4> Ambulance Details:</h4>
                                        <p><strong>Ambulance ID:</strong> {patient.ambulance.ambulanceId}</p>
                                        <p><strong>Number Plate:</strong> {patient.ambulance.numberPlate}</p>
                                        <p><strong>Driver:</strong> {patient.ambulance.driver?.name}</p>
                                        <p><strong>Phone:</strong> {patient.ambulance.driver?.phone}</p>

                                        {(() => {
                                            const etaInfo = getAmbulanceETA(patient.ambulance?._id);
                                            if (etaInfo) {
                                                return (
                                                    <div className="eta-section">
                                                        <h5> Live Location & ETA</h5>
                                                        <p><strong>Distance:</strong> {etaInfo.distance}</p>
                                                        <p className="eta-highlight">
                                                            <strong>ETA:</strong> <span className="eta-value">{etaInfo.eta} mins</span>
                                                        </p>
                                                        <p className="location-coords">
                                                            <strong>Coords:</strong> {etaInfo.lat.toFixed(4)}, {etaInfo.lng.toFixed(4)}
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                )}

                                <div className="vitals-section">
                                    <h4>Latest Vitals:</h4>
                                    {(() => {
                                        const liveVitals = patient.ambulance?._id
                                            ? liveVitalsByAmbulance[patient.ambulance._id]
                                            : null;
                                        const vitals = liveVitals?.vitals || patient.vitals;
                                        return (
                                            <>
                                                <div className="vitals-mini">
                                                    <span>BP: {vitals?.systolicBP}/{vitals?.diastolicBP}</span>
                                                    <span>HR: {vitals?.heartRate} bpm</span>
                                                    <span>O2: {vitals?.spo2}%</span>
                                                    <span>Temp: {vitals?.temperature}°C</span>
                                                </div>
                                                <div className="vitals-mini">
                                                    <span>Pain: {vitals?.painScore}/10</span>
                                                    <span>RR: {vitals?.respiratoryRate} rpm</span>
                                                </div>
                                                {liveVitals?.timestamp && (
                                                    <div className="timestamp">
                                                        Live update: {new Date(liveVitals.timestamp).toLocaleTimeString()}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>

                                <div className="risk-prediction">
                                    <h4>Risk Prediction:</h4>
                                    <p>Level: {patient.riskPrediction?.level}/5</p>
                                    <p>Score: {(patient.riskPrediction?.score * 100).toFixed(1)}%</p>
                                </div>

                                {patient.paramedicNotes && (
                                    <div className="notes-section">
                                        <h4>Paramedic Notes:</h4>
                                        <p>{patient.paramedicNotes}</p>
                                    </div>
                                )}

                                <div className="timestamp">
                                    Updated: {new Date(patient.updatedAt).toLocaleTimeString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HospitalPage;
