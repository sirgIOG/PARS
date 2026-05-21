import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { watchLocation, stopWatchingLocation, getCurrentLocation } from '../utils/locationUtils.js';
import '../styles/AmbulancePage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Leaflet mini-map shown on the Driver tab.
 * Pins: blue = ambulance current GPS, red = destination hospital.
 * Draws a dashed line between them.
 */
const DriverMap = ({ ambulanceLat, ambulanceLng, hospitalLat, hospitalLng, hospitalName }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const ambMarkerRef = useRef(null);
    const hospitalMarkerRef = useRef(null);
    const lineRef = useRef(null);

    // Initialise map on mount
    useEffect(() => {
        if (mapInstanceRef.current) return; // already created
        const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        mapInstanceRef.current = map;
        return () => {
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    // Update pins + line whenever coords change
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        const hasAmb = ambulanceLat != null && ambulanceLng != null;
        const hasHosp = hospitalLat != null && hospitalLng != null;

        // Ambulance pin (blue)
        if (hasAmb) {
            const ambIcon = L.divIcon({
                className: '',
                html: '<div style="width:14px;height:14px;border-radius:50%;background:#3399ff;border:2px solid #fff;box-shadow:0 0 6px #3399ff"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
            });
            if (ambMarkerRef.current) {
                ambMarkerRef.current.setLatLng([ambulanceLat, ambulanceLng]);
            } else {
                ambMarkerRef.current = L.marker([ambulanceLat, ambulanceLng], { icon: ambIcon })
                    .addTo(map).bindPopup('🚑 Ambulance');
            }
        }

        // Hospital pin (red)
        if (hasHosp) {
            const hospIcon = L.divIcon({
                className: '',
                html: '<div style="width:14px;height:14px;border-radius:50%;background:#ff4444;border:2px solid #fff;box-shadow:0 0 6px #ff4444"></div>',
                iconSize: [14, 14],
                iconAnchor: [7, 7],
            });
            if (hospitalMarkerRef.current) {
                hospitalMarkerRef.current.setLatLng([hospitalLat, hospitalLng]);
            } else {
                hospitalMarkerRef.current = L.marker([hospitalLat, hospitalLng], { icon: hospIcon })
                    .addTo(map).bindPopup(`🏥 ${hospitalName || 'Hospital'}`);
            }
        }

        // Route line
        if (hasAmb && hasHosp) {
            const latlngs = [[ambulanceLat, ambulanceLng], [hospitalLat, hospitalLng]];
            if (lineRef.current) {
                lineRef.current.setLatLngs(latlngs);
            } else {
                lineRef.current = L.polyline(latlngs, {
                    color: '#6e6ef0', weight: 3, dashArray: '8 5', opacity: 0.85
                }).addTo(map);
            }
            map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30] });
        } else if (hasAmb) {
            map.setView([ambulanceLat, ambulanceLng], 14);
        } else if (hasHosp) {
            map.setView([hospitalLat, hospitalLng], 14);
        }
    }, [ambulanceLat, ambulanceLng, hospitalLat, hospitalLng, hospitalName]);

    return (
        <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: '11px', color: '#888', marginBottom: 6 }}>
                🔵 You &nbsp;·&nbsp; 🔴 {hospitalName || 'Destination'}
            </p>
            <div ref={mapRef} style={{ height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid #252530' }} />
        </div>
    );
};


const AmbulancePage = () => {
    const [socket, setSocket] = useState(null);
    const [ambulances, setAmbulances] = useState([]);
    const [selectedAmbulance, setSelectedAmbulance] = useState('');
    const [assignedIncident, setAssignedIncident] = useState(null);
    const selectedAmbulanceRef = useRef('');
    const [currentLocation, setCurrentLocation] = useState({ lat: null, lng: null });
    const [locationWatchId, setLocationWatchId] = useState(null);
    const [isTrackingLocation, setIsTrackingLocation] = useState(false);
    const [patientData, setPatientData] = useState({
        painScore: '',
        systolicBP: '',
        diastolicBP: '',
        heartRate: 0,
        respiratoryRate: 0,
        temperature: 0,
        spo2: 0,
        age: '',
        sex: '',
        symptoms: '',
        knownConditions: {
            hypertension: false,
            diabetes: false,
            cardiacHistory: false
        },
        paramedicNotes: ''
    });

    const [submitted, setSubmitted] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const [isAmbulanceLocked, setIsAmbulanceLocked] = useState(false);
    const [activeTab, setActiveTab] = useState('driver');
    const [statusMsg, setStatusMsg] = useState('');
    const navigate = useNavigate();

    // ── Clinical Assessment State ─────────────────────────────
    const [clinical, setClinical] = useState({
        // GCS
        gcs_eye: null,      // 1-4
        gcs_verbal: null,   // 1-5
        gcs_motor: null,    // 1-6
        // AVPU
        avpu: null,         // 'A' | 'V' | 'P' | 'U'
        // Skin
        skin_color: null,   // 'Normal' | 'Pale' | 'Flushed' | 'Cyanotic' | 'Mottled'
        skin_temp: null,    // 'Warm' | 'Cool' | 'Cold' | 'Hot'
        skin_moisture: null,// 'Dry' | 'Moist' | 'Diaphoretic'
        // Pupils
        pupils_equal: null, // true | false
        pupils_reactive: null, // true | false
        pupils_size: null,  // 'Normal' | 'Dilated' | 'Constricted' | 'Unequal'
        // Respiratory effort
        resp_effort: null,  // 'Normal' | 'Laboured' | 'Agonal' | 'None'
        // SAMPLE
        allergies: '',
        medications: '',
        last_oral_intake: '',
    });

    const setC = (key, val) => setClinical(prev => ({ ...prev, [key]: val }));


    useEffect(() => {
        const fetchAmbulances = async () => {
            try {
                const user = JSON.parse(localStorage.getItem('user') || '{}');
                const token = localStorage.getItem('token');

                if (user.ambulanceId) {
                    const res = await fetch(`${API}/api/ambulances/${user.ambulanceId}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const ambulance = await res.json();
                        setAmbulances([ambulance]);
                        setSelectedAmbulance(ambulance._id);
                        setIsAmbulanceLocked(true);
                    }
                } else {
                    const response = await fetch(`${API}/api/ambulances/available`);
                    if (response.ok) {
                        const data = await response.json();
                        setAmbulances(data);
                    }
                }
            } catch (error) {
                console.error('Error fetching ambulances:', error);
            }
        };

        fetchAmbulances();

        const newSocket = io(API, {
            transports: ['polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5
        });

        newSocket.on('connect', () => {
            setConnectionStatus('Connected');
        });

        newSocket.on('disconnect', () => {
            setConnectionStatus('Disconnected');
        });

        newSocket.on('dispatchAssigned', (incident) => {
            const activeAmbulance = selectedAmbulanceRef.current;
            if (incident?.assignedAmbulance?._id && incident.assignedAmbulance._id === activeAmbulance) {
                setAssignedIncident(incident);
            }
        });

        newSocket.on('deviceVitals', (data) => {
            setPatientData(prev => ({
                ...prev,
                heartRate: data.heartRate || 0,
                respiratoryRate: data.respiratoryRate || 0,
                temperature: data.temperature || 0,
                spo2: data.spo2 || 0
            }));
        });

        setSocket(newSocket);

        return () => {
            if (locationWatchId !== null) {
                stopWatchingLocation(locationWatchId);
            }
            newSocket.disconnect();
        };
    }, [locationWatchId]);

    useEffect(() => {
        selectedAmbulanceRef.current = selectedAmbulance;
        if (!selectedAmbulance) {
            setAssignedIncident(null);
        }
    }, [selectedAmbulance]);

    const startLocationTracking = async () => {
        try {
            const location = await getCurrentLocation();
            setCurrentLocation(location);

            const watchId = watchLocation((position) => {
                setCurrentLocation({
                    lat: position.lat,
                    lng: position.lng
                });

                if (socket) {
                    socket.emit('ambulanceLocation', {
                        ambulanceId: selectedAmbulance,
                        lat: position.lat,
                        lng: position.lng,
                        timestamp: new Date()
                    });
                }
            });

            setLocationWatchId(watchId);
            setIsTrackingLocation(true);
        } catch (error) {
            console.error('Error starting location tracking:', error);
            alert('Unable to access location. Please enable location permissions.');
        }
    };

    const stopLocationTracking = () => {
        if (locationWatchId !== null) {
            stopWatchingLocation(locationWatchId);
            setLocationWatchId(null);
            setIsTrackingLocation(false);
        }
    };

    const pushStatus = async (status) => {
        if (!assignedIncident?._id) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(
                `${API}/api/dispatch/incidents/${assignedIncident._id}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ status }),
                }
            );
            if (res.ok) {
                const updated = await res.json();
                setAssignedIncident(updated);
                setStatusMsg(`Status: ${status}`);
                setTimeout(() => setStatusMsg(''), 1800);
            }
        } catch (err) {
            console.error('status push failed', err);
        }
    };

    const handleManualInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setPatientData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: type === 'checkbox' ? checked : value
                }
            }));
        } else {
            setPatientData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!patientData.painScore || !patientData.systolicBP || !patientData.diastolicBP) {
            alert('Please fill in all manual vital fields');
            return;
        }

        if (!patientData.age || !patientData.sex) {
            alert('Please fill in age and sex');
            return;
        }

        if (!selectedAmbulance) {
            alert('Please select an ambulance');
            return;
        }

        try {
            const gcsTotal = (clinical.gcs_eye||0) + (clinical.gcs_verbal||0) + (clinical.gcs_motor||0);
            const clinicalNotes = [
                `AVPU: ${clinical.avpu || 'Not assessed'}`,
                gcsTotal > 0 ? `GCS: E${clinical.gcs_eye||'?'}V${clinical.gcs_verbal||'?'}M${clinical.gcs_motor||'?'}=${gcsTotal}` : 'GCS: Not assessed',
                clinical.resp_effort ? `Resp effort: ${clinical.resp_effort}` : '',
                clinical.skin_color ? `Skin: ${clinical.skin_color} / ${clinical.skin_temp || '?'} / ${clinical.skin_moisture || '?'}` : '',
                clinical.pupils_size ? `Pupils: ${clinical.pupils_size}, Equal:${clinical.pupils_equal}, Reactive:${clinical.pupils_reactive}` : '',
                clinical.allergies ? `Allergies: ${clinical.allergies}` : '',
                clinical.medications ? `Meds: ${clinical.medications}` : '',
                clinical.last_oral_intake ? `Last oral intake: ${clinical.last_oral_intake}` : '',
                patientData.paramedicNotes || '',
            ].filter(Boolean).join(' | ');

            const response = await fetch(`${API}/api/patients/vitals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    incidentId: assignedIncident?._id,
                    age: parseInt(patientData.age),
                    sex: patientData.sex,
                    vitals: {
                        systolicBP: parseFloat(patientData.systolicBP),
                        diastolicBP: parseFloat(patientData.diastolicBP),
                        heartRate: patientData.heartRate,
                        respiratoryRate: patientData.respiratoryRate,
                        temperature: patientData.temperature,
                        painScore: parseFloat(patientData.painScore),
                        spo2: patientData.spo2
                    },
                    symptoms: patientData.symptoms.split(',').map(s => s.trim()).filter(s => s),
                    knownConditions: patientData.knownConditions,
                    paramedicNotes: clinicalNotes,
                    ambulanceId: selectedAmbulance,
                    dataSource: 'manual',
                    clinicalAssessment: {
                        gcs: gcsTotal > 0 ? { eye: clinical.gcs_eye, verbal: clinical.gcs_verbal, motor: clinical.gcs_motor, total: gcsTotal } : null,
                        avpu: clinical.avpu,
                        skinAssessment: clinical.skin_color ? { color: clinical.skin_color, temperature: clinical.skin_temp, moisture: clinical.skin_moisture } : null,
                        pupils: clinical.pupils_size ? { equal: clinical.pupils_equal, reactive: clinical.pupils_reactive, size: clinical.pupils_size } : null,
                        respiratoryEffort: clinical.resp_effort,
                        allergies: clinical.allergies || null,
                        medications: clinical.medications || null,
                        lastOralIntake: clinical.last_oral_intake || null,
                    }
                })
            });

            if (response.ok) {
                const result = await response.json();
                setSubmitted(true);
                setAssignedIncident(null);
                setTimeout(() => setSubmitted(false), 300);

                navigate('/ambulance/session', {
                    state: {
                        patient: result,
                        ambulanceId: selectedAmbulance,
                        incidentId: assignedIncident?._id || null,
                        hospital: result?.hospital || null
                    }
                });
            } else {
                const errorData = await response.json();
                alert(errorData.error || 'Error submitting patient data');
            }
        } catch (error) {
            console.error('Error submitting patient data:', error);
            alert('Error submitting patient data');
        }
    };

    return (
        <div className="ambulance-page">
            <header className="ambulance-header">
                <h1>Ambulance Crew Console</h1>
                <div className={`connection-status ${connectionStatus === 'Connected' ? 'connected' : 'disconnected'}`}>
                    {connectionStatus}
                </div>
            </header>

            <div className="tab-bar">
                <button
                    className={`tab-btn ${activeTab === 'driver' ? 'active' : ''}`}
                    onClick={() => setActiveTab('driver')}
                >
                    🚑 Driver
                </button>
                <button
                    className={`tab-btn ${activeTab === 'paramedic' ? 'active' : ''}`}
                    onClick={() => setActiveTab('paramedic')}
                >
                    🩺 Paramedic
                </button>
            </div>

            {activeTab === 'driver' && (
                <div className="driver-view">
                    {statusMsg && <div className="status-toast">{statusMsg}</div>}

                    <div className="form-section">
                        <h2>Unit</h2>
                        {isAmbulanceLocked && ambulances[0] ? (
                            <p className="big-id">
                                {ambulances[0].ambulanceId} · {ambulances[0].numberPlate}
                            </p>
                        ) : (
                            <select
                                value={selectedAmbulance}
                                onChange={(e) => setSelectedAmbulance(e.target.value)}
                            >
                                <option value="">Select an ambulance</option>
                                {ambulances.map((ambulance) => (
                                    <option key={ambulance._id} value={ambulance._id}>
                                        {ambulance.ambulanceId} - {ambulance.numberPlate}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="form-section">
                        <h2>GPS Tracking</h2>
                        <div className="location-controls">
                            {!isTrackingLocation ? (
                                <button
                                    type="button"
                                    className="location-btn start big"
                                    onClick={startLocationTracking}
                                    disabled={!selectedAmbulance}
                                >
                                    ▶ Start GPS
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="location-btn stop big"
                                    onClick={stopLocationTracking}
                                >
                                    ■ Stop GPS
                                </button>
                            )}
                        </div>
                        {currentLocation.lat && currentLocation.lng && (
                            <div className="location-display">
                                <p className="coords-big">
                                    {currentLocation.lat.toFixed(5)}, {currentLocation.lng.toFixed(5)}
                                </p>
                                <p className="tracking-status">
                                    {isTrackingLocation ? '● LIVE' : '○ OFFLINE'}
                                </p>
                            </div>
                        )}
                    </div>

                    {assignedIncident ? (
                        <div className="form-section">
                            <h2>Active Run</h2>
                            <div className="ambulance-details">
                                <div className="detail-group">
                                    <h3>Incident</h3>
                                    <p><strong>Complaint:</strong> {assignedIncident.chiefComplaint}</p>
                                    <p><strong>Address:</strong> {assignedIncident.location?.address || 'No address'}</p>
                                    <p><strong>Priority:</strong> {assignedIncident.priority}</p>
                                    <p><strong>Status:</strong> {assignedIncident.status}</p>
                                </div>
                                {assignedIncident.assignedHospital && (
                                    <div className="detail-group">
                                        <h3>Destination Hospital</h3>
                                        <p><strong>{assignedIncident.assignedHospital.name}</strong></p>
                                        <p>{assignedIncident.assignedHospital.location?.address || ''}</p>
                                        {assignedIncident.etaMinutes != null && (
                                            <p><strong>ETA:</strong> {assignedIncident.etaMinutes} min</p>
                                        )}
                                        <DriverMap
                                            ambulanceLat={currentLocation.lat}
                                            ambulanceLng={currentLocation.lng}
                                            hospitalLat={assignedIncident.assignedHospital.location?.lat}
                                            hospitalLng={assignedIncident.assignedHospital.location?.lng}
                                            hospitalName={assignedIncident.assignedHospital.name}
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="status-buttons">
                                <button type="button" className="status-btn" onClick={() => pushStatus('en_route')}>
                                    En Route
                                </button>
                                <button type="button" className="status-btn" onClick={() => pushStatus('on_scene')}>
                                    On Scene
                                </button>
                                <button type="button" className="status-btn" onClick={() => pushStatus('transporting')}>
                                    Transporting
                                </button>
                                <button type="button" className="status-btn" onClick={() => pushStatus('at_hospital')}>
                                    At Hospital
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="form-section">
                            <h2>Active Run</h2>
                            <p className="empty-hint">No active assignment. Waiting on dispatch.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'paramedic' && (submitted ? (
                <div className="success-message">
                    Patient data submitted successfully!
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="vitals-form">
                    <div className="form-section">
                        <h2>Ambulance Information</h2>
                        <div className="form-group">
                            <label>Select Ambulance *</label>
                            <select
                                value={selectedAmbulance}
                                onChange={(e) => setSelectedAmbulance(e.target.value)}
                                required
                                disabled={isAmbulanceLocked}
                            >
                                <option value="">Select an ambulance</option>
                                {ambulances.map((ambulance) => (
                                    <option key={ambulance._id} value={ambulance._id}>
                                        {ambulance.ambulanceId} - {ambulance.numberPlate}
                                    </option>
                                ))}
                            </select>
                            {isAmbulanceLocked && (
                                <p className="tracking-status">Ambulance locked to your login.</p>
                            )}
                        </div>

                        {selectedAmbulance && ambulances.find(a => a._id === selectedAmbulance) && (
                            <div className="ambulance-details">
                                {(() => {
                                    const selected = ambulances.find(a => a._id === selectedAmbulance);
                                    return (
                                        <>
                                            <div className="detail-group">
                                                <h3>Driver Information</h3>
                                                <p><strong>Name:</strong> {selected.driver.name}</p>
                                                <p><strong>Phone:</strong> {selected.driver.phone}</p>
                                                <p><strong>License Number:</strong> {selected.driver.licenseNumber}</p>
                                            </div>
                                            <div className="detail-group">
                                                <h3>Vehicle Details</h3>
                                                <p><strong>Ambulance ID:</strong> {selected.ambulanceId}</p>
                                                <p><strong>Number Plate:</strong> {selected.numberPlate}</p>
                                                <p><strong>Model:</strong> {selected.vehicle.model}</p>
                                                <p><strong>Color:</strong> {selected.vehicle.color}</p>
                                                <p><strong>Capacity:</strong> {selected.vehicle.capacity} patients</p>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    {assignedIncident && (
                        <div className="form-section">
                            <h2>Assigned Incident</h2>
                            <div className="ambulance-details">
                                <div className="detail-group">
                                    <h3>Caller Intake</h3>
                                    <p><strong>Complaint:</strong> {assignedIncident.chiefComplaint}</p>
                                    <p><strong>Symptoms:</strong> {assignedIncident.symptoms?.join(', ') || 'Not provided'}</p>
                                    <p><strong>Address:</strong> {assignedIncident.location?.address || 'No address'}</p>
                                </div>
                                <div className="detail-group">
                                    <h3>Priority</h3>
                                    <p><strong>Priority:</strong> {assignedIncident.priority}</p>
                                    <p><strong>Unit Type:</strong> {assignedIncident.ambulanceType}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="form-section">
                        <h2>Location Tracking</h2>
                        <div className="location-controls">
                            {!isTrackingLocation ? (
                                <button
                                    type="button"
                                    className="location-btn start"
                                    onClick={startLocationTracking}
                                    disabled={!selectedAmbulance}
                                >
                                    Start Location Tracking
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="location-btn stop"
                                    onClick={stopLocationTracking}
                                >
                                    Stop Location Tracking
                                </button>
                            )}
                        </div>

                        {currentLocation.lat && currentLocation.lng && (
                            <div className="location-display">
                                <h3>Current Location</h3>
                                <div className="location-info">
                                    <p><strong>Latitude:</strong> {currentLocation.lat.toFixed(6)}</p>
                                    <p><strong>Longitude:</strong> {currentLocation.lng.toFixed(6)}</p>
                                    <p className="tracking-status">
                                        {isTrackingLocation ? 'Tracking Active' : 'Tracking Inactive'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="form-section">
                        <h2>Basic Information</h2>
                        <div className="form-group">
                            <label>Age *</label>
                            <input
                                type="number"
                                name="age"
                                value={patientData.age}
                                onChange={handleManualInputChange}
                                min="0"
                                max="120"
                                required
                                placeholder="Patient age"
                            />
                        </div>

                        <div className="form-group">
                            <label>Sex *</label>
                            <select
                                name="sex"
                                value={patientData.sex}
                                onChange={handleManualInputChange}
                                required
                            >
                                <option value="">Select sex</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Symptoms</label>
                            <input
                                type="text"
                                name="symptoms"
                                value={patientData.symptoms}
                                onChange={handleManualInputChange}
                                placeholder="e.g., chest pain, shortness of breath"
                            />
                        </div>

                        <div className="form-group">
                            <label>Paramedic Notes</label>
                            <textarea
                                name="paramedicNotes"
                                value={patientData.paramedicNotes}
                                onChange={handleManualInputChange}
                                placeholder="Additional notes about the patient"
                                rows="3"
                            />
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>Medical History</h2>
                        <div className="checkbox-group">
                            <label>
                                <input
                                    type="checkbox"
                                    name="knownConditions.hypertension"
                                    checked={patientData.knownConditions.hypertension}
                                    onChange={handleManualInputChange}
                                />
                                Hypertension
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    name="knownConditions.diabetes"
                                    checked={patientData.knownConditions.diabetes}
                                    onChange={handleManualInputChange}
                                />
                                Diabetes
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    name="knownConditions.cardiacHistory"
                                    checked={patientData.knownConditions.cardiacHistory}
                                    onChange={handleManualInputChange}
                                />
                                Cardiac History
                            </label>
                        </div>
                    </div>

                    {/* ═══════════════════════════════════════════════
                        CLINICAL PROTOCOLS — tap-to-select UI
                    ═══════════════════════════════════════════════ */}
                    <div className="form-section clinical-section">
                        <h2>Clinical Protocols</h2>

                        {/* ── Red Flags auto-banner ── */}
                        {(() => {
                            const gcsT = (clinical.gcs_eye||0)+(clinical.gcs_verbal||0)+(clinical.gcs_motor||0);
                            const syst = parseFloat(patientData.systolicBP)||0;
                            const spo2v = patientData.spo2||0;
                            const flags = [
                                gcsT > 0 && gcsT < 9   && '⚠ GCS < 9 — Severe neurological impairment',
                                (clinical.avpu === 'P' || clinical.avpu === 'U') && '⚠ AVPU P/U — Unresponsive / Pain-only response',
                                spo2v > 0 && spo2v < 90  && '⚠ SpO2 < 90% — Critical hypoxia',
                                syst > 0 && syst < 90  && '⚠ SBP < 90 mmHg — Hypotensive shock',
                                clinical.resp_effort === 'Agonal' && '⚠ Agonal breathing — Imminent arrest',
                                clinical.resp_effort === 'None'   && '⚠ No respiratory effort — Apnoea',
                            ].filter(Boolean);
                            return flags.length > 0 ? (
                                <div className="clinical-flags">
                                    {flags.map((f,i) => <div key={i} className="flag-item">{f}</div>)}
                                </div>
                            ) : null;
                        })()}

                        {/* ── GCS ── */}
                        <div className="proto-block">
                            <div className="proto-title">
                                Glasgow Coma Scale (GCS)
                                <span className="proto-score">
                                    {(clinical.gcs_eye||0)+(clinical.gcs_verbal||0)+(clinical.gcs_motor||0) > 0
                                        ? (() => {
                                            const t = (clinical.gcs_eye||0)+(clinical.gcs_verbal||0)+(clinical.gcs_motor||0);
                                            const sev = t <= 8 ? 'Severe' : t <= 12 ? 'Moderate' : 'Mild/Normal';
                                            return `${t} / 15 — ${sev}`;
                                          })()
                                        : '—'}
                                </span>
                            </div>
                            <div className="gcs-row">
                                <span className="gcs-cat">Eye (E)</span>
                                <div className="gcs-btns">
                                {[{v:4,l:'Spontaneous'},{v:3,l:'To Voice'},{v:2,l:'To Pain'},{v:1,l:'None'}].map(o => (
                                    <button key={o.v} type="button"
                                        className={`proto-btn ${clinical.gcs_eye===o.v?'active':''}`}
                                        onClick={() => setC('gcs_eye', clinical.gcs_eye===o.v ? null : o.v)}>
                                        <strong>{o.v}</strong> {o.l}
                                    </button>
                                ))}
                                </div>
                            </div>
                            <div className="gcs-row">
                                <span className="gcs-cat">Verbal (V)</span>
                                <div className="gcs-btns">
                                {[{v:5,l:'Oriented'},{v:4,l:'Confused'},{v:3,l:'Words'},{v:2,l:'Sounds'},{v:1,l:'None'}].map(o => (
                                    <button key={o.v} type="button"
                                        className={`proto-btn ${clinical.gcs_verbal===o.v?'active':''}`}
                                        onClick={() => setC('gcs_verbal', clinical.gcs_verbal===o.v ? null : o.v)}>
                                        <strong>{o.v}</strong> {o.l}
                                    </button>
                                ))}
                                </div>
                            </div>
                            <div className="gcs-row">
                                <span className="gcs-cat">Motor (M)</span>
                                <div className="gcs-btns">
                                {[{v:6,l:'Obeys'},{v:5,l:'Localises'},{v:4,l:'Withdraws'},{v:3,l:'Flexion'},{v:2,l:'Extension'},{v:1,l:'None'}].map(o => (
                                    <button key={o.v} type="button"
                                        className={`proto-btn ${clinical.gcs_motor===o.v?'active':''}`}
                                        onClick={() => setC('gcs_motor', clinical.gcs_motor===o.v ? null : o.v)}>
                                        <strong>{o.v}</strong> {o.l}
                                    </button>
                                ))}
                                </div>
                            </div>
                        </div>

                        {/* ── AVPU ── */}
                        <div className="proto-block">
                            <div className="proto-title">AVPU Consciousness Scale</div>
                            <div className="avpu-row">
                                {[
                                    {k:'A', label:'Alert',       hint:'Fully awake & oriented', color:'#22c55e'},
                                    {k:'V', label:'Voice',       hint:'Responds to verbal', color:'#eab308'},
                                    {k:'P', label:'Pain',        hint:'Responds to pain only', color:'#f97316'},
                                    {k:'U', label:'Unresponsive',hint:'No response', color:'#ef4444'},
                                ].map(o => (
                                    <button key={o.k} type="button"
                                        className={`avpu-btn ${clinical.avpu===o.k?'active':''}`}
                                        style={clinical.avpu===o.k ? {borderColor: o.color, background: o.color+'22', color: o.color} : {}}
                                        onClick={() => setC('avpu', clinical.avpu===o.k ? null : o.k)}>
                                        <span className="avpu-letter">{o.k}</span>
                                        <span className="avpu-label">{o.label}</span>
                                        <span className="avpu-hint">{o.hint}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Shock Index (auto-calculated) ── */}
                        {patientData.heartRate > 0 && parseFloat(patientData.systolicBP) > 0 && (() => {
                            const si = (patientData.heartRate / parseFloat(patientData.systolicBP)).toFixed(2);
                            const level = si < 0.6 ? {l:'Normal', c:'#22c55e'}
                                       : si < 0.9 ? {l:'Mild', c:'#a3e635'}
                                       : si < 1.4 ? {l:'Moderate — Monitor closely', c:'#f97316'}
                                       :            {l:'Severe — High suspicion of shock', c:'#ef4444'};
                            return (
                                <div className="proto-block">
                                    <div className="proto-title">Shock Index (HR ÷ SBP) — auto</div>
                                    <div className="shock-index-display" style={{borderColor: level.c}}>
                                        <span className="si-value" style={{color: level.c}}>{si}</span>
                                        <span className="si-label" style={{color: level.c}}>{level.l}</span>
                                        <span className="si-range">Normal &lt; 0.6 · Mild 0.6–0.9 · Moderate 0.9–1.4 · Severe &gt; 1.4</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* ── Respiratory Effort ── */}
                        <div className="proto-block">
                            <div className="proto-title">Respiratory Effort</div>
                            <div className="tap-row">
                                {['Normal','Laboured','Agonal','None'].map(v => (
                                    <button key={v} type="button"
                                        className={`proto-btn ${clinical.resp_effort===v?'active':''}`}
                                        onClick={() => setC('resp_effort', clinical.resp_effort===v ? null : v)}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── Skin Assessment ── */}
                        <div className="proto-block">
                            <div className="proto-title">Skin Assessment</div>
                            <div className="skin-row">
                                <span className="gcs-cat">Color</span>
                                <div className="gcs-btns">
                                {['Normal','Pale','Flushed','Cyanotic','Mottled'].map(v => (
                                    <button key={v} type="button"
                                        className={`proto-btn small ${clinical.skin_color===v?'active':''}`}
                                        onClick={() => setC('skin_color', clinical.skin_color===v ? null : v)}>{v}</button>
                                ))}
                                </div>
                            </div>
                            <div className="skin-row">
                                <span className="gcs-cat">Temp</span>
                                <div className="gcs-btns">
                                {['Warm','Cool','Cold','Hot'].map(v => (
                                    <button key={v} type="button"
                                        className={`proto-btn small ${clinical.skin_temp===v?'active':''}`}
                                        onClick={() => setC('skin_temp', clinical.skin_temp===v ? null : v)}>{v}</button>
                                ))}
                                </div>
                            </div>
                            <div className="skin-row">
                                <span className="gcs-cat">Moisture</span>
                                <div className="gcs-btns">
                                {['Dry','Moist','Diaphoretic'].map(v => (
                                    <button key={v} type="button"
                                        className={`proto-btn small ${clinical.skin_moisture===v?'active':''}`}
                                        onClick={() => setC('skin_moisture', clinical.skin_moisture===v ? null : v)}>{v}</button>
                                ))}
                                </div>
                            </div>
                        </div>

                        {/* ── Pupils (PEARL) ── */}
                        <div className="proto-block">
                            <div className="proto-title">Pupils — PEARL Check</div>
                            <div className="pupils-row">
                                <div className="pupil-group">
                                    <span className="gcs-cat">Equal?</span>
                                    {[{v:true,l:'✓ Yes'},{v:false,l:'✗ No'}].map(o => (
                                        <button key={String(o.v)} type="button"
                                            className={`proto-btn small ${clinical.pupils_equal===o.v?'active':''}`}
                                            onClick={() => setC('pupils_equal', clinical.pupils_equal===o.v ? null : o.v)}>{o.l}</button>
                                    ))}
                                </div>
                                <div className="pupil-group">
                                    <span className="gcs-cat">Reactive?</span>
                                    {[{v:true,l:'✓ Yes'},{v:false,l:'✗ No'}].map(o => (
                                        <button key={String(o.v)} type="button"
                                            className={`proto-btn small ${clinical.pupils_reactive===o.v?'active':''}`}
                                            onClick={() => setC('pupils_reactive', clinical.pupils_reactive===o.v ? null : o.v)}>{o.l}</button>
                                    ))}
                                </div>
                                <div className="pupil-group">
                                    <span className="gcs-cat">Size</span>
                                    {['Normal','Dilated','Constricted','Unequal'].map(v => (
                                        <button key={v} type="button"
                                            className={`proto-btn small ${clinical.pupils_size===v?'active':''}`}
                                            onClick={() => setC('pupils_size', clinical.pupils_size===v ? null : v)}>{v}</button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── SAMPLE Quick History ── */}
                        <div className="proto-block">
                            <div className="proto-title">SAMPLE Quick History</div>
                            <div className="sample-grid">
                                <label>Allergies
                                    <input type="text" value={clinical.allergies}
                                        onChange={e => setC('allergies', e.target.value)}
                                        placeholder="NKDA / Penicillin / Latex..."/>
                                </label>
                                <label>Current Medications
                                    <input type="text" value={clinical.medications}
                                        onChange={e => setC('medications', e.target.value)}
                                        placeholder="Aspirin 75mg, Metformin..."/>
                                </label>
                                <label>Last Oral Intake
                                    <input type="text" value={clinical.last_oral_intake}
                                        onChange={e => setC('last_oral_intake', e.target.value)}
                                        placeholder="e.g., 2 hrs ago — tea and biscuits"/>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>Manual Vital Input (Required)</h2>
                        <div className="vitals-grid">
                            <div className="form-group">
                                <label>Systolic BP (mmHg) *</label>
                                <input
                                    type="number"
                                    name="systolicBP"
                                    value={patientData.systolicBP}
                                    onChange={handleManualInputChange}
                                    placeholder="e.g., 120"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Diastolic BP (mmHg) *</label>
                                <input
                                    type="number"
                                    name="diastolicBP"
                                    value={patientData.diastolicBP}
                                    onChange={handleManualInputChange}
                                    placeholder="e.g., 80"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Pain Score (0-10) *</label>
                                <input
                                    type="number"
                                    name="painScore"
                                    value={patientData.painScore}
                                    onChange={handleManualInputChange}
                                    min="0"
                                    max="10"
                                    placeholder="0-10"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>Live Device Vitals</h2>
                        <div className="vitals-grid">
                            <div className="vital-display">
                                <label>Heart Rate (bpm)</label>
                                <div className="vital-value">{patientData.heartRate}</div>
                            </div>

                            <div className="vital-display">
                                <label>Respiratory Rate (rpm)</label>
                                <div className="vital-value">{patientData.respiratoryRate}</div>
                            </div>

                            <div className="vital-display">
                                <label>Temperature (C)</label>
                                <div className="vital-value">{patientData.temperature.toFixed(1)}</div>
                            </div>

                            <div className="vital-display">
                                <label>SpO2 (%)</label>
                                <div className="vital-value">{patientData.spo2}</div>
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="submit-btn">
                        Submit Patient Data
                    </button>
                </form>
            ))}
        </div>
    );
};

export default AmbulancePage;
