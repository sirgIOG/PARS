import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import '../styles/AmbulanceSessionPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AmbulanceSessionPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { patient, ambulanceId, incidentId, hospital, hospitalOptions } = location.state || {};

    const [socket, setSocket] = useState(null);
    const [liveVitals, setLiveVitals] = useState(patient?.vitals || {});
    const [ending, setEnding] = useState(false);
    const [status, setStatus] = useState('');
    const emitTimerRef = useRef(null);

    // Hospital-switch state (from bhuvandev)
    const [currentHospital, setCurrentHospital] = useState(hospital || null);
    const [currentOptions, setCurrentOptions] = useState(hospitalOptions || []);
    const [switching, setSwitching] = useState(false);
    const [switchStatus, setSwitchStatus] = useState('');

    // Inline vitals update state (from pars)
    const [updateForm, setUpdateForm] = useState({
        systolicBP: '', diastolicBP: '', heartRate: '',
        respiratoryRate: '', spo2: '', painScore: ''
    });
    const [updateStatus, setUpdateStatus] = useState('');

    const fillWorseVitals = () => setUpdateForm({
        systolicBP: '85', diastolicBP: '55', heartRate: '145',
        respiratoryRate: '28', spo2: '82', painScore: '10'
    });

    const submitVitalsUpdate = async () => {
        if (!patient || !ambulanceId) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`${API}/api/patients/vitals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    incidentId: incidentId || null,
                    age: patient.age,
                    sex: patient.sex,
                    vitals: {
                        systolicBP: parseFloat(updateForm.systolicBP),
                        diastolicBP: parseFloat(updateForm.diastolicBP),
                        heartRate: parseFloat(updateForm.heartRate),
                        respiratoryRate: parseFloat(updateForm.respiratoryRate),
                        temperature: liveVitals.temperature || 37.2,
                        spo2: parseFloat(updateForm.spo2),
                        painScore: parseFloat(updateForm.painScore),
                    },
                    symptoms: patient.symptoms || [],
                    ambulanceId,
                    dataSource: 'manual',
                }),
            });
            if (res.ok) {
                setUpdateStatus('✓ Vitals updated — dispatcher notified');
                setTimeout(() => setUpdateStatus(''), 3000);
            } else {
                setUpdateStatus('Update failed');
            }
        } catch (err) {
            setUpdateStatus('Update failed');
        }
    };

    useEffect(() => {
        if (!patient || !ambulanceId) {
            navigate('/ambulance');
            return;
        }

        const newSocket = io(API, {
            transports: ['polling'],
            reconnection: true,
            reconnectionDelay: 1000
        });

        newSocket.on('deviceVitals', (data) => {
            setLiveVitals(prev => ({
                ...prev,
                heartRate: data.heartRate || prev.heartRate,
                respiratoryRate: data.respiratoryRate || prev.respiratoryRate,
                temperature: data.temperature || prev.temperature,
                spo2: data.spo2 || prev.spo2
            }));
        });

        // Listen for dispatcher-initiated reroutes so the UI auto-updates
        newSocket.on('incidentRerouted', (incident) => {
            if (incident._id === incidentId && incident.assignedHospital) {
                setCurrentHospital(incident.assignedHospital);
            }
        });

        setSocket(newSocket);

        return () => { newSocket.disconnect(); };
    }, [patient, ambulanceId, navigate, incidentId]);

    // Emit live vitals on every change (debounced)
    useEffect(() => {
        if (!socket || !ambulanceId) return;
        if (emitTimerRef.current) clearTimeout(emitTimerRef.current);

        emitTimerRef.current = setTimeout(() => {
            socket.emit('liveVitals', {
                ambulanceId,
                incidentId: incidentId || null,
                hospitalId: currentHospital?._id || null,
                patient: {
                    age: patient?.age || null,
                    sex: patient?.sex || null,
                    symptoms: patient?.symptoms || []
                },
                vitals: {
                    systolicBP: liveVitals?.systolicBP || null,
                    diastolicBP: liveVitals?.diastolicBP || null,
                    heartRate: liveVitals?.heartRate || null,
                    respiratoryRate: liveVitals?.respiratoryRate || null,
                    temperature: liveVitals?.temperature || null,
                    painScore: liveVitals?.painScore || null,
                    spo2: liveVitals?.spo2 || null
                },
                timestamp: new Date()
            });
        }, 500);

        return () => { if (emitTimerRef.current) clearTimeout(emitTimerRef.current); };
    }, [socket, ambulanceId, incidentId, currentHospital, patient, liveVitals]);

    const handleEndSession = async () => {
        if (!incidentId) { navigate('/ambulance'); return; }
        setEnding(true);
        setStatus('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/api/dispatch/incidents/${incidentId}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'at_hospital' })
            });
            if (!response.ok) {
                const data = await response.json();
                setStatus(data.error || 'Failed to end session');
            } else {
                navigate('/ambulance');
            }
        } catch (error) {
            setStatus('Failed to end session');
        } finally {
            setEnding(false);
        }
    };

    // Hospital-switch handler (from bhuvandev)
    const handleSwitchHospital = async (hospitalId) => {
        if (!incidentId || !hospitalId) return;
        setSwitching(true);
        setSwitchStatus('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/api/dispatch/incidents/${incidentId}/hospital`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ hospitalId })
            });
            if (!response.ok) {
                const data = await response.json();
                setSwitchStatus(data.error || 'Failed to change hospital');
                return;
            }
            const updated = await response.json();
            setCurrentHospital(updated.assignedHospital || null);
            setCurrentOptions(updated.hospitalOptions || []);
            setSwitchStatus('✓ Hospital updated');
            setTimeout(() => setSwitchStatus(''), 2500);
        } catch (error) {
            setSwitchStatus('Failed to change hospital');
        } finally {
            setSwitching(false);
        }
    };

    return (
        <div className="ambulance-session-page">
            <header className="session-header">
                <div>
                    <h1>Live Patient Session</h1>
                    <p>Monitor vitals and track risk while en route.</p>
                </div>
                <button className="end-btn" onClick={handleEndSession} disabled={ending}>
                    {ending ? 'Ending...' : 'End Session'}
                </button>
            </header>

            {status && <div className="session-alert">{status}</div>}

            <section className="session-grid">
                {/* Incident Category */}
                <div className="session-card">
                    <h2>Incident Category</h2>
                    <p style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>
                        {patient?.incident?.category || 'general'}
                    </p>
                    <p style={{ color: 'var(--apple-text-secondary)', marginTop: 4 }}>
                        ESI Level: {patient?.riskPrediction?.level ?? '—'}
                    </p>
                </div>

                {/* Destination Hospital */}
                <div className="session-card">
                    <h2>Destination Hospital</h2>
                    <p><strong>Name:</strong> {currentHospital?.name || 'Pending'}</p>
                    {currentHospital?.location?.address && (
                        <p><strong>Address:</strong> {currentHospital.location.address}</p>
                    )}
                    {currentHospital?.location?.lat && currentHospital?.location?.lng && (
                        <p className="coords-small">
                            {currentHospital.location.lat.toFixed(4)}, {currentHospital.location.lng.toFixed(4)}
                        </p>
                    )}
                </div>

                {/* Risk Score */}
                <div className="session-card">
                    <h2>Risk Score</h2>
                    <p className="risk-level">Level: {patient?.riskPrediction?.level || 'N/A'} / 5</p>
                    <p>Category: {patient?.riskPrediction?.category || 'N/A'}</p>
                    {patient?.riskPrediction?.score != null && (
                        <p>Score: {(patient.riskPrediction.score * 100).toFixed(1)}%</p>
                    )}
                </div>

                {/* Live Vitals */}
                <div className="session-card vitals">
                    <h2>Live Vitals</h2>
                    <div className="vitals-grid">
                        <div><span>BP</span><strong>{liveVitals?.systolicBP}/{liveVitals?.diastolicBP}</strong></div>
                        <div><span>Heart Rate</span><strong>{liveVitals?.heartRate} bpm</strong></div>
                        <div><span>Resp Rate</span><strong>{liveVitals?.respiratoryRate} rpm</strong></div>
                        <div><span>Temperature</span><strong>{liveVitals?.temperature} °C</strong></div>
                        <div><span>SpO2</span><strong>{liveVitals?.spo2}%</strong></div>
                        <div><span>Pain</span><strong>{liveVitals?.painScore}/10</strong></div>
                    </div>
                </div>

                {/* Inline Vitals Update (pars) */}
                <div className="session-card">
                    <h2>Update Vitals En Route</h2>
                    {updateStatus && <p className="session-alert">{updateStatus}</p>}
                    <button className="demo-worsen-btn" onClick={fillWorseVitals}>
                        ⚠ Demo: Patient Deteriorating
                    </button>
                    <div className="update-grid">
                        {[
                            ['systolicBP','Systolic BP'],['diastolicBP','Diastolic BP'],
                            ['heartRate','Heart Rate'],['respiratoryRate','Resp Rate'],
                            ['spo2','SpO2'],['painScore','Pain (0-10)']
                        ].map(([key, label]) => (
                            <label key={key}>
                                {label}
                                <input type="number"
                                    value={updateForm[key]}
                                    onChange={e => setUpdateForm(p => ({...p, [key]: e.target.value}))}
                                    placeholder="—"
                                />
                            </label>
                        ))}
                    </div>
                    <button className="submit-update-btn" onClick={submitVitalsUpdate}>
                        Submit Vitals Update
                    </button>
                </div>

                {/* Backup Hospital Options (bhuvandev) */}
                <div className="session-card">
                    <h2>Backup Hospital Options</h2>
                    {switchStatus && <div className="session-alert">{switchStatus}</div>}
                    {currentOptions?.filter(o => o.hospital?._id !== currentHospital?._id).length ? (
                        currentOptions
                            .filter(o => o.hospital?._id !== currentHospital?._id)
                            .slice(0, 3)
                            .map((option) => (
                                <div key={option._id || option.hospital?._id} className="hospital-option">
                                    <p><strong>{option.hospital?.name || 'Unknown'}</strong></p>
                                    {option.distanceKm != null && (
                                        <p className="option-detail">{option.distanceKm.toFixed(2)} km away</p>
                                    )}
                                    {option.etaMinutes != null && (
                                        <p className="option-detail">ETA: {option.etaMinutes} min</p>
                                    )}
                                    <button
                                        type="button"
                                        className="switch-hospital-btn"
                                        onClick={() => handleSwitchHospital(option.hospital?._id)}
                                        disabled={switching}
                                    >
                                        {switching ? 'Switching...' : '↪ Switch Here'}
                                    </button>
                                </div>
                            ))
                    ) : (
                        <p style={{ color: '#888', fontSize: '13px' }}>No ranked alternatives available yet.</p>
                    )}
                </div>
            </section>
        </div>
    );
};

export default AmbulanceSessionPage;
