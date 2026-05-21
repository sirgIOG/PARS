import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import '../styles/AdminPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AdminPage = () => {
    const [socket, setSocket] = useState(null);
    const [stats, setStats] = useState({
        totalPatients: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalAmbulances: 0,
        availableAmbulances: 0,
        onDutyAmbulances: 0,
        maintenanceAmbulances: 0
    });
    const [patients, setPatients] = useState([]);
    const [ambulancesByStatus, setAmbulancesByStatus] = useState({
        available: [],
        onDuty: [],
        maintenance: []
    });
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [selectedTab, setSelectedTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || '{}');

        // Initialize WebSocket connection
        const newSocket = io(API, {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            auth: { token }
        });

        newSocket.on('connect', () => {
            console.log('Admin connected to server');
            setConnectionStatus('Connected');
            // Fetch initial data
            fetchStats(token);
            fetchPatients(token);
            fetchAmbulances(token);
        });

        newSocket.on('disconnect', () => {
            setConnectionStatus('Disconnected');
        });

        // Real-time updates
        newSocket.on('patientUpdate', (patient) => {
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


        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const fetchStats = async (token) => {
        try {
            setLoading(true);
            const response = await fetch(`${API}/api/admin/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setStats({
                    totalPatients: data.totalPatients || 0,
                    highRiskCount: data.highRiskCount || 0,
                    mediumRiskCount: data.mediumRiskCount || 0,
                    lowRiskCount: data.lowRiskCount || 0,
                    totalAmbulances: data.totalAmbulances || 0,
                    availableAmbulances: data.availableAmbulances || 0,
                    onDutyAmbulances: data.onDutyAmbulances || 0,
                    maintenanceAmbulances: data.maintenanceAmbulances || 0
                });
                setError(null);
            } else if (response.status === 401) {
                setError('Unauthorized - Please login again');
                window.location.href = '/';
            } else {
                setError('Failed to fetch statistics');
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
            setError('Error fetching statistics');
        } finally {
            setLoading(false);
        }
    };

    const fetchPatients = async (token) => {
        try {
            const response = await fetch(`${API}/api/admin/patients`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setPatients(data);
            } else if (response.status === 401) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Error fetching patients:', error);
        }
    };

    const fetchAmbulances = async (token) => {
        try {
            const response = await fetch(`${API}/api/admin/ambulances`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setAmbulancesByStatus(data);
            } else if (response.status === 401) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Error fetching ambulances:', error);
        }
    };


    const handleExport = () => {
        const dataStr = JSON.stringify(patients, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `patients_${new Date().getTime()}.json`;
        link.click();
    };

    const handleDeletePatient = async (patientId) => {
        if (!window.confirm('Are you sure you want to delete this patient record?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/api/patients/${patientId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                setPatients(prev => prev.filter(p => p._id !== patientId));
            } else if (response.status === 401) {
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Error deleting patient:', error);
        }
    };

    return (
        <div className="admin-page">
            <header className="admin-header">
                <h1>️ Admin Dashboard</h1>
                <div className={`connection-status ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}>
                    {connectionStatus}
                </div>
            </header>

            {error && (
                <div className="error-message">
                    ️ {error}
                </div>
            )}

            <nav className="admin-nav">
                <button
                    className={`tab-btn ${selectedTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('overview')}
                >
                    Overview
                </button>
                <button
                    className={`tab-btn ${selectedTab === 'ambulances' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('ambulances')}
                >
                    Ambulances ({stats.totalAmbulances})
                </button>
                <button
                    className={`tab-btn ${selectedTab === 'patients' ? 'active' : ''}`}
                    onClick={() => setSelectedTab('patients')}
                >
                    Patients ({stats.totalPatients})
                </button>
            </nav>

            {selectedTab === 'overview' && (
                <div className="overview-section">
                    <div className="stats-grid">
                        <div className="stat-card total">
                            <h3>Total Patients</h3>
                            <div className="stat-value">{stats.totalPatients}</div>
                        </div>

                        <div className="stat-card high">
                            <h3>High Risk</h3>
                            <div className="stat-value">{stats.highRiskCount}</div>
                        </div>

                        <div className="stat-card medium">
                            <h3>Medium Risk</h3>
                            <div className="stat-value">{stats.mediumRiskCount}</div>
                        </div>

                        <div className="stat-card low">
                            <h3>Low Risk</h3>
                            <div className="stat-value">{stats.lowRiskCount}</div>
                        </div>

                        <div className="stat-card ambulance available">
                            <h3>Available Ambulances</h3>
                            <div className="stat-value">{stats.availableAmbulances}</div>
                        </div>

                        <div className="stat-card ambulance onduty">
                            <h3>On-Duty</h3>
                            <div className="stat-value">{stats.onDutyAmbulances}</div>
                        </div>

                        <div className="stat-card ambulance maintenance">
                            <h3>In Maintenance</h3>
                            <div className="stat-value">{stats.maintenanceAmbulances}</div>
                        </div>

                        <div className="stat-card ambulance total-ambulance">
                            <h3>Total Ambulances</h3>
                            <div className="stat-value">{stats.totalAmbulances}</div>
                        </div>
                    </div>

                    <div className="recent-activity">
                        <h2>Recent Patient Activity</h2>
                        <div className="activity-list">
                            {patients.slice(0, 5).map((patient) => (
                                <div key={patient._id} className="activity-item">
                                    <div className="activity-info">
                                        <p className="activity-patient">Patient {patient._id?.slice(-6)}</p>
                                        <p className="activity-time">
                                            {new Date(patient.updatedAt).toLocaleTimeString()}
                                        </p>
                                    </div>
                                    <div
                                        className="activity-risk"
                                        style={{
                                            color: patient.riskPrediction?.category === 'HIGH' ? '#ff4444' :
                                                patient.riskPrediction?.category === 'MEDIUM' ? '#ffa500' : '#44ff44'
                                        }}
                                    >
                                        {patient.riskPrediction?.category}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {selectedTab === 'ambulances' && (
                <div className="ambulances-section">
                    <h2>Ambulance Fleet</h2>

                    <div className="amb-status-group">
                        <h3 className="status-heading available-heading">🟢 Available ({ambulancesByStatus.available.length})</h3>
                        {ambulancesByStatus.available.length === 0 ? (
                            <div className="no-data">No available ambulances</div>
                        ) : (
                            <div className="ambulance-cards">
                                {ambulancesByStatus.available.map((amb) => (
                                    <div key={amb._id} className="ambulance-card status-available">
                                        <div className="amb-card-header">
                                            <h4>{amb.ambulanceId}</h4>
                                            <span className="amb-status-badge available">Available</span>
                                        </div>
                                        <p><strong>Plate:</strong> {amb.vehicleDetails?.numberPlate || 'N/A'}</p>
                                        <p><strong>Type:</strong> {amb.vehicleDetails?.type || 'N/A'}</p>
                                        <p><strong>Model:</strong> {amb.vehicleDetails?.model || 'N/A'}</p>
                                        <p><strong>Driver:</strong> {amb.driverDetails?.name || 'N/A'}</p>
                                        <p><strong>Contact:</strong> {amb.driverDetails?.contact || 'N/A'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="amb-status-group">
                        <h3 className="status-heading onduty-heading"> On Duty ({ambulancesByStatus.onDuty.length})</h3>
                        {ambulancesByStatus.onDuty.length === 0 ? (
                            <div className="no-data">No ambulances on duty</div>
                        ) : (
                            <div className="ambulance-cards">
                                {ambulancesByStatus.onDuty.map((amb) => (
                                    <div key={amb._id} className="ambulance-card status-onduty">
                                        <div className="amb-card-header">
                                            <h4>{amb.ambulanceId}</h4>
                                            <span className="amb-status-badge onduty">On Duty</span>
                                        </div>
                                        <p><strong>Plate:</strong> {amb.vehicleDetails?.numberPlate || 'N/A'}</p>
                                        <p><strong>Type:</strong> {amb.vehicleDetails?.type || 'N/A'}</p>
                                        <p><strong>Model:</strong> {amb.vehicleDetails?.model || 'N/A'}</p>
                                        <p><strong>Driver:</strong> {amb.driverDetails?.name || 'N/A'}</p>
                                        <p><strong>Contact:</strong> {amb.driverDetails?.contact || 'N/A'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="amb-status-group">
                        <h3 className="status-heading maintenance-heading">🟡 Maintenance ({ambulancesByStatus.maintenance.length})</h3>
                        {ambulancesByStatus.maintenance.length === 0 ? (
                            <div className="no-data">No ambulances in maintenance</div>
                        ) : (
                            <div className="ambulance-cards">
                                {ambulancesByStatus.maintenance.map((amb) => (
                                    <div key={amb._id} className="ambulance-card status-maintenance">
                                        <div className="amb-card-header">
                                            <h4>{amb.ambulanceId}</h4>
                                            <span className="amb-status-badge maintenance">Maintenance</span>
                                        </div>
                                        <p><strong>Plate:</strong> {amb.vehicleDetails?.numberPlate || 'N/A'}</p>
                                        <p><strong>Type:</strong> {amb.vehicleDetails?.type || 'N/A'}</p>
                                        <p><strong>Model:</strong> {amb.vehicleDetails?.model || 'N/A'}</p>
                                        <p><strong>Driver:</strong> {amb.driverDetails?.name || 'N/A'}</p>
                                        <p><strong>Notes:</strong> {amb.maintenanceNotes || 'None'}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedTab === 'patients' && (
                <div className="patients-section">
                    <div className="section-header">
                        <h2>Patient Records</h2>
                        <button className="export-btn" onClick={handleExport}>
                             Export Data
                        </button>
                    </div>

                    <div className="patients-table-wrapper">
                        <table className="patients-table">
                            <thead>
                                <tr>
                                    <th>Patient ID</th>
                                    <th>Age</th>
                                    <th>Sex</th>
                                    <th>Risk Level</th>
                                    <th>BP</th>
                                    <th>HR</th>
                                    <th>O2</th>
                                    <th>Temp</th>
                                    <th>Last Updated</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {patients.map((patient) => (
                                    <tr key={patient._id}>
                                        <td>{patient._id?.slice(-6)}</td>
                                        <td>{patient.age}</td>
                                        <td>{patient.sex}</td>
                                        <td>
                                            <span
                                                className="risk-badge-table"
                                                style={{
                                                    backgroundColor: patient.riskPrediction?.category === 'HIGH' ? '#ff4444' :
                                                        patient.riskPrediction?.category === 'MEDIUM' ? '#ffa500' : '#44ff44'
                                                }}
                                            >
                                                {patient.riskPrediction?.category}
                                            </span>
                                        </td>
                                        <td>{patient.vitals?.systolicBP}/{patient.vitals?.diastolicBP}</td>
                                        <td>{patient.vitals?.heartRate}</td>
                                        <td>{patient.vitals?.spo2}%</td>
                                        <td>{patient.vitals?.temperature}°C</td>
                                        <td>{new Date(patient.updatedAt).toLocaleTimeString()}</td>
                                        <td>
                                            <button
                                                className="delete-btn"
                                                onClick={() => handleDeletePatient(patient._id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
