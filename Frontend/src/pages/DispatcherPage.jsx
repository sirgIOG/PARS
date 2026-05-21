import { useEffect, useState, useCallback, useMemo } from 'react';
import io from 'socket.io-client';
import LiveMap from '../components/LiveMap.jsx';
import '../styles/DispatcherPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

const DispatcherPage = () => {
	const [queue, setQueue] = useState([]);
	const [activeIncidents, setActiveIncidents] = useState([]);
	const [ambulances, setAmbulances] = useState([]);
	const [allAmbulances, setAllAmbulances] = useState([]);
	const [hospitals, setHospitals] = useState([]);
	const [livePositions, setLivePositions] = useState({});
	const [recsByIncident, setRecsByIncident] = useState({});
	const [connectionStatus, setConnectionStatus] = useState('Connecting...');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [rerouteAlert, setRerouteAlert] = useState(null);

	const fetchRecommendations = useCallback(async (incidentId) => {
		const token = localStorage.getItem('token');
		try {
			const res = await fetch(`${API}/api/dispatch/incidents/${incidentId}/recommendations`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const data = await res.json();
				setRecsByIncident((prev) => ({ ...prev, [incidentId]: data }));
			}
		} catch (err) {
			console.error('recs failed', err);
		}
	}, []);

	const fetchActiveIncidents = useCallback(async () => {
		const token = localStorage.getItem('token');
		try {
			const res = await fetch(`${API}/api/dispatch/active`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				const data = await res.json();
				setActiveIncidents(Array.isArray(data) ? data : []);
			}
		} catch (err) {
			console.error('active incidents failed', err);
		}
	}, []);

	useEffect(() => {
		const token = localStorage.getItem('token');
		const socket = io(API, { transports: ['polling'], reconnection: true, auth: { token } });

		socket.on('connect', () => setConnectionStatus('Connected'));
		socket.on('disconnect', () => setConnectionStatus('Disconnected'));

		socket.on('newCall', (incident) => {
			setQueue((prev) => [incident, ...prev]);
			fetchRecommendations(incident._id);
		});

		socket.on('dispatchAssigned', (incident) => {
			setQueue((prev) => prev.filter((i) => i._id !== incident._id));
			setActiveIncidents((prev) => {
				const exists = prev.find((i) => i._id === incident._id);
				return exists
					? prev.map((i) => (i._id === incident._id ? incident : i))
					: [incident, ...prev];
			});
		});

		socket.on('incidentStatusUpdate', (incident) => {
			setActiveIncidents((prev) => {
				if (['handover_complete', 'closed'].includes(incident.status)) {
					return prev.filter((i) => i._id !== incident._id);
				}
				return prev.map((i) => (i._id === incident._id ? incident : i));
			});
		});

		socket.on('incidentRerouted', (incident) => {
			setActiveIncidents((prev) =>
				prev.map((i) => (i._id === incident._id ? incident : i))
			);
			setRerouteAlert(null);
		});

		socket.on('case:reroute_suggested', (payload) => {
			setRerouteAlert(payload);
		});

		socket.on('ambulanceLocationUpdate', (data) => {
			if (!data?.ambulanceId) return;
			setLivePositions((prev) => ({
				...prev,
				[data.ambulanceId]: { lat: data.lat, lng: data.lng, ts: Date.now() },
			}));
		});

		setLoading(false);

		return () => socket.disconnect();
	}, [fetchRecommendations]);

	useEffect(() => {
		const token = localStorage.getItem('token');

		const fetchQueue = async () => {
			try {
				const res = await fetch(`${API}/api/dispatch/queue`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				const data = await res.json();
				if (res.ok) {
					setQueue(data);
					data.forEach((i) => fetchRecommendations(i._id));
				} else {
					setError(data.error || 'Failed to load queue');
				}
			} catch (err) {
				setError('Failed to load queue');
			}
		};

		const fetchAmbulances = async () => {
			try {
				const res = await fetch(`${API}/api/ambulances/available`);
				if (res.ok) setAmbulances(await res.json());
			} catch (err) {
				console.error('ambulances failed');
			}
		};

		const fetchAllAmbulances = async () => {
			try {
				const res = await fetch(`${API}/api/ambulances`);
				if (res.ok) setAllAmbulances(await res.json());
			} catch (err) {
				console.error('all ambulances failed');
			}
		};

		const fetchHospitals = async () => {
			try {
				const res = await fetch(`${API}/api/dispatch/hospitals`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) setHospitals(await res.json());
			} catch (err) {
				console.error('hospitals failed');
			}
		};

		fetchQueue();
		fetchAmbulances();
		fetchAllAmbulances();
		fetchHospitals();
		fetchActiveIncidents();
	}, [fetchRecommendations, fetchActiveIncidents]);

	// Build map data: ambulances with live overrides, hospitals, queue + active incidents
	const mapAmbulances = useMemo(() => {
		const seen = new Set();
		const merged = [];
		allAmbulances.forEach((a) => {
			seen.add(a._id);
			const live = livePositions[a._id] || livePositions[a.ambulanceId];
			merged.push({
				id: a._id,
				code: a.ambulanceId,
				lat: live?.lat ?? a.currentLocation?.lat,
				lng: live?.lng ?? a.currentLocation?.lng,
				status: a.status,
				busy: a.status !== 'available',
			});
		});
		// Active incidents may carry assignedAmbulance with fresher position
		activeIncidents.forEach((i) => {
			const a = i.assignedAmbulance;
			if (!a || seen.has(a._id)) return;
			seen.add(a._id);
			const live = livePositions[a._id] || livePositions[a.ambulanceId];
			merged.push({
				id: a._id,
				code: a.ambulanceId,
				lat: live?.lat ?? a.currentLocation?.lat,
				lng: live?.lng ?? a.currentLocation?.lng,
				status: a.status,
				busy: true,
			});
		});
		return merged;
	}, [allAmbulances, livePositions, activeIncidents]);

	const mapHospitals = useMemo(() => {
		const activeHospitalIds = new Set(
			activeIncidents
				.map((i) => i.assignedHospital?._id)
				.filter(Boolean)
		);
		return hospitals.map((h) => ({
			id: h._id,
			name: h.name,
			lat: h.location?.lat,
			lng: h.location?.lng,
			active: activeHospitalIds.has(h._id),
		}));
	}, [hospitals, activeIncidents]);

	const mapIncidents = useMemo(() => {
		return [...queue, ...activeIncidents].map((i) => ({
			id: i._id,
			lat: i.location?.lat,
			lng: i.location?.lng,
			category: i.category,
		}));
	}, [queue, activeIncidents]);

	const handleAssign = async (incidentId, formState) => {
		setError('');
		const token = localStorage.getItem('token');
		try {
			const res = await fetch(`${API}/api/dispatch/assign`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					incidentId,
					priority: formState.priority,
					ambulanceType: formState.ambulanceType,
					ambulanceId: formState.ambulanceId || undefined,
					hospitalId: formState.hospitalId || undefined,
					dispatcherNotes: formState.dispatcherNotes,
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				setError(data.error || 'Unable to assign ambulance');
				return;
			}
			setQueue((prev) => prev.filter((i) => i._id !== incidentId));
			setActiveIncidents((prev) => [data, ...prev]);
		} catch (err) {
			setError('Unable to assign ambulance');
		}
	};

	const handlePreAlert = async (incidentId) => {
		const token = localStorage.getItem('token');
		try {
			const res = await fetch(`${API}/api/dispatch/incidents/${incidentId}/pre-alert`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			});
			if (res.ok) {
				setActiveIncidents((prev) =>
					prev.map((i) =>
						i._id === incidentId ? { ...i, preAlertSentAt: new Date().toISOString() } : i
					)
				);
			}
		} catch (err) {
			setError('Pre-alert failed');
		}
	};

	const handleReroute = async (incidentId, hospitalId) => {
		const token = localStorage.getItem('token');
		try {
			const res = await fetch(`${API}/api/dispatch/incidents/${incidentId}/reroute`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ hospitalId }),
			});
			if (res.ok) {
				const data = await res.json();
				setActiveIncidents((prev) =>
					prev.map((i) => (i._id === incidentId ? data : i))
				);
				setRerouteAlert(null);
			}
		} catch (err) {
			setError('Reroute failed');
		}
	};

	const handleStatus = async (incidentId, status) => {
		const token = localStorage.getItem('token');
		try {
			await fetch(`${API}/api/dispatch/incidents/${incidentId}/status`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ status }),
			});
		} catch (err) {
			setError('Status update failed');
		}
	};

	const handleForceRescore = async () => {
		const token = localStorage.getItem('token');
		try {
			await fetch(`${API}/api/dispatch/force-rescore`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			});
		} catch (err) {
			console.error('rescore failed', err);
		}
	};


	return (
		<div className="dispatcher-page">
			<header className="dispatcher-header">
				<div>
					<h1>Dispatcher Console</h1>
					<p>Category-aware routing. Ranked hospitals. One-click reroute.</p>
				</div>
				<div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
					<button className="force-btn" onClick={handleForceRescore}>
						⚡ Force Rescore
					</button>
					<div
						className={`connection-status ${
							connectionStatus === 'Connected' ? 'connected' : 'disconnected'
						}`}
					>
						{connectionStatus}
					</div>
				</div>
			</header>

			{error && <div className="dispatcher-error">{error}</div>}

			{rerouteAlert && (
				<div className="reroute-banner">
					<div className="reroute-banner-text">
						<strong>⚠ Reroute suggested</strong>
						<p>{rerouteAlert.reason}</p>
						{rerouteAlert.currentHospital && (
							<p>
								Current: <strong>{rerouteAlert.currentHospital.name}</strong>
								{rerouteAlert.suggestedHospital && (
									<>
										{' '}→ Suggested:{' '}
										<strong>{rerouteAlert.suggestedHospital.name}</strong> (
										{rerouteAlert.suggestedHospital.etaMinutes} min, tier{' '}
										{rerouteAlert.suggestedHospital.tier})
									</>
								)}
							</p>
						)}
					</div>
					<div className="reroute-banner-actions">
						{rerouteAlert.shouldReroute && rerouteAlert.suggestedHospital && (
							<button
								className="reroute-accept"
								onClick={() =>
									handleReroute(
										rerouteAlert.incidentId,
										rerouteAlert.suggestedHospital.hospitalId
									)
								}
							>
								Accept Reroute
							</button>
						)}
						<button className="reroute-dismiss" onClick={() => setRerouteAlert(null)}>
							Dismiss
						</button>
					</div>
				</div>
			)}

			<section className="dispatch-summary">
				<div>
					<h3>Active Queue</h3>
					<span>{queue.length}</span>
				</div>
				<div>
					<h3>In-Flight</h3>
					<span>{activeIncidents.length}</span>
				</div>
				<div>
					<h3>Available Units</h3>
					<span>{ambulances.length}</span>
				</div>
			</section>

			<section className="map-section">
				<h2 className="section-title" style={{ marginTop: 0 }}>Live Operations Map</h2>
				<LiveMap
					ambulances={mapAmbulances}
					hospitals={mapHospitals}
					incidents={mapIncidents}
					height={420}
				/>
				<div className="map-legend">
					<span><i style={{ background: '#2563eb' }} /> Available unit</span>
					<span><i style={{ background: '#f59e0b' }} /> Busy unit</span>
					<span><i style={{ background: '#10b981' }} /> Hospital</span>
					<span><i style={{ background: '#e63946' }} /> Receiving hospital</span>
					<span><i style={{ background: '#ef4444' }} /> Incident</span>
				</div>
			</section>

			<h2 className="section-title">Incoming Queue</h2>
			<section className="dispatch-grid">
				{loading ? (
					<div className="dispatcher-loading">Loading queue...</div>
				) : queue.length === 0 ? (
					<div className="dispatcher-empty">No incoming calls right now.</div>
				) : (
					queue.map((incident) => (
						<DispatchCard
							key={incident._id}
							incident={incident}
							ambulances={ambulances}
							recs={recsByIncident[incident._id]}
							onAssign={handleAssign}
						/>
					))
				)}
			</section>

			{activeIncidents.length > 0 && (
				<>
					<h2 className="section-title">In-Flight Incidents</h2>
					<section className="dispatch-grid">
						{activeIncidents.map((incident) => (
							<ActiveCard
								key={incident._id}
								incident={incident}
								onPreAlert={handlePreAlert}
								onStatus={handleStatus}
								onReroute={handleReroute}
							/>
						))}
					</section>
				</>
			)}
		</div>
	);
};

const CategoryBadge = ({ category, confidence }) => {
	if (!category) return null;
	const color = CATEGORY_COLORS[category] || '#6c757d';
	return (
		<span className="category-badge" style={{ background: color }}>
			{category}
			{confidence != null && (
				<small> {Math.round(confidence * 100)}%</small>
			)}
		</span>
	);
};

const DispatchCard = ({ incident, ambulances, recs, onAssign }) => {
	const [priority, setPriority] = useState(incident.priority || 'MEDIUM');
	const [ambulanceType, setAmbulanceType] = useState(incident.ambulanceType || 'BLS');
	const [ambulanceId, setAmbulanceId] = useState('');
	const [hospitalId, setHospitalId] = useState('');
	const [dispatcherNotes, setDispatcherNotes] = useState('');

	const topHospitals = recs?.hospitals || [];
	const topAmbulances = recs?.ambulances || [];

	return (
		<div className="dispatch-card">
			<div className="dispatch-header">
				<h2>Incident {incident._id?.slice(-6)}</h2>
				<span className="dispatch-time">
					{new Date(incident.createdAt).toLocaleTimeString()}
				</span>
			</div>

			<div className="dispatch-info">
				<div className="badge-row">
					<CategoryBadge
						category={incident.category}
						confidence={incident.categoryConfidence}
					/>
					{incident.categoryAlternatives?.length > 0 && (
						<span className="alt-cats">
							alt: {incident.categoryAlternatives.slice(0, 2).join(', ')}
						</span>
					)}
				</div>
				<p>
					<strong>Complaint:</strong> {incident.chiefComplaint}
				</p>
				<p>
					<strong>Symptoms:</strong> {incident.symptoms?.join(', ') || 'Not provided'}
				</p>
				<p>
					<strong>Address:</strong> {incident.location?.address || 'No address'}
				</p>
			</div>

			{topHospitals.length > 0 && (
				<div className="recs-block">
					<h4>Recommended Hospitals</h4>
					{topHospitals.slice(0, 3).map((h, idx) => (
						<label key={h.hospitalId} className="rec-row">
							<input
								type="radio"
								name={`hosp-${incident._id}`}
								value={h.hospitalId}
								checked={hospitalId === h.hospitalId || (idx === 0 && !hospitalId)}
								onChange={() => setHospitalId(h.hospitalId)}
							/>
							<div className="rec-body">
								<div className="rec-title">
									<strong>
										{idx + 1}. {h.name}
									</strong>
									<span className="rec-eta">
										{h.etaMinutes}min · {h.distanceKm}km · tier {h.tier}
									</span>
								</div>
								<div className="rec-reasons">
									{h.reasons?.slice(0, 3).map((r, i) => (
										<span key={i} className="reason-pill">
											{r}
										</span>
									))}
								</div>
							</div>
						</label>
					))}
				</div>
			)}

			{topAmbulances.length > 0 && (
				<div className="recs-block">
					<h4>Recommended Units</h4>
					{topAmbulances.slice(0, 3).map((a, idx) => (
						<label key={a.ambulanceId} className="rec-row">
							<input
								type="radio"
								name={`amb-${incident._id}`}
								value={a.ambulanceId}
								checked={ambulanceId === a.ambulanceId || (idx === 0 && !ambulanceId)}
								onChange={() => setAmbulanceId(a.ambulanceId)}
							/>
							<div className="rec-body">
								<div className="rec-title">
									<strong>
										{idx + 1}. {a.code} ({a.serviceLevel})
									</strong>
									<span className="rec-eta">
										{a.distanceKm != null ? `${a.distanceKm.toFixed(1)}km` : '?'}
									</span>
								</div>
								<div className="rec-reasons">
									{a.reasons?.slice(0, 3).map((r, i) => (
										<span key={i} className="reason-pill">
											{r}
										</span>
									))}
								</div>
							</div>
						</label>
					))}
				</div>
			)}

			<div className="dispatch-controls">
				<div className="ctrl-row">
					<label>
						Priority
						<select value={priority} onChange={(e) => setPriority(e.target.value)}>
							<option value="HIGH">HIGH</option>
							<option value="MEDIUM">MEDIUM</option>
							<option value="LOW">LOW</option>
						</select>
					</label>
					<label>
						Type
						<select
							value={ambulanceType}
							onChange={(e) => setAmbulanceType(e.target.value)}
						>
							<option value="ALS">ALS</option>
							<option value="BLS">BLS</option>
						</select>
					</label>
				</div>
				<label className="notes">
					Dispatcher Notes
					<textarea
						rows="2"
						value={dispatcherNotes}
						onChange={(e) => setDispatcherNotes(e.target.value)}
						placeholder="Triage notes, hazards, directions"
					/>
				</label>
			</div>

			<button
				className="assign-btn"
				onClick={() =>
					onAssign(incident._id, {
						priority,
						ambulanceType,
						ambulanceId: ambulanceId || topAmbulances[0]?.ambulanceId || '',
						hospitalId: hospitalId || topHospitals[0]?.hospitalId || '',
						dispatcherNotes,
					})
				}
			>
				Assign & Dispatch
			</button>
		</div>
	);
};

const ActiveCard = ({ incident, onPreAlert, onStatus, onReroute }) => {
	const recs = incident.hospitalRecommendations || [];
	const [showAlt, setShowAlt] = useState(false);
	const [altHospitalId, setAltHospitalId] = useState('');

	return (
		<div className="dispatch-card active-card">
			<div className="dispatch-header">
				<h2>Incident {incident._id?.slice(-6)}</h2>
				<span className={`status-pill status-${incident.status}`}>{incident.status}</span>
			</div>

			<div className="dispatch-info">
				<div className="badge-row">
					<CategoryBadge
						category={incident.category}
						confidence={incident.categoryConfidence}
					/>
				</div>
				<p>
					<strong>Hospital:</strong> {incident.assignedHospital?.name || '—'}
				</p>
				<p>
					<strong>Unit:</strong> {incident.assignedAmbulance?.ambulanceId || '—'}
				</p>
				{incident.etaMinutes != null && (
					<p>
						<strong>ETA:</strong> {incident.etaMinutes} min
					</p>
				)}
				{incident.preAlertSentAt && (
					<p className="pre-alert-stamp">
						✓ Pre-alert sent {new Date(incident.preAlertSentAt).toLocaleTimeString()}
					</p>
				)}
			</div>

			<div className="active-actions">
				{!incident.preAlertSentAt && (
					<button className="action-btn primary" onClick={() => onPreAlert(incident._id)}>
						Send Pre-Alert
					</button>
				)}
				<button
					className="action-btn"
					onClick={() => onStatus(incident._id, 'en_route')}
				>
					En Route
				</button>
				<button
					className="action-btn"
					onClick={() => onStatus(incident._id, 'on_scene')}
				>
					On Scene
				</button>
				<button
					className="action-btn"
					onClick={() => onStatus(incident._id, 'transporting')}
				>
					Transporting
				</button>
				<button
					className="action-btn"
					onClick={() => onStatus(incident._id, 'at_hospital')}
				>
					At Hospital
				</button>
				<button className="action-btn" onClick={() => setShowAlt((s) => !s)}>
					{showAlt ? 'Hide' : 'Reroute…'}
				</button>
			</div>

			{showAlt && recs.length > 0 && (
				<div className="recs-block">
					<h4>Reroute Options</h4>
					{recs.slice(0, 3).map((h, idx) => (
						<label key={h.hospitalId} className="rec-row">
							<input
								type="radio"
								name={`alt-${incident._id}`}
								value={h.hospitalId}
								checked={altHospitalId === h.hospitalId}
								onChange={() => setAltHospitalId(h.hospitalId)}
							/>
							<div className="rec-body">
								<div className="rec-title">
									<strong>
										{idx + 1}. {h.name}
									</strong>
									<span className="rec-eta">
										{h.etaMinutes}min · tier {h.tier}
									</span>
								</div>
							</div>
						</label>
					))}
					<button
						className="action-btn primary"
						disabled={!altHospitalId}
						onClick={() => {
							onReroute(incident._id, altHospitalId);
							setShowAlt(false);
							setAltHospitalId('');
						}}
					>
						Confirm Reroute
					</button>
				</div>
			)}
		</div>
	);
};

export default DispatcherPage;
