import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import '../styles/HISPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Mock Hospital Information System (HIS) view.
 * This is intentionally styled like a legacy bed-board terminal so the demo
 * can sell the framing: "WeWooWeWoo sits on top of the existing HIS."
 *
 * Reads hospital state from /api/dispatch/hospitals and listens for
 * pre-alerts and reroutes via Socket.IO so each hospital tile shows
 * incoming patients in real time.
 */
const HISPage = () => {
	const [hospitals, setHospitals] = useState([]);
	const [incomingByHospital, setIncomingByHospital] = useState({});
	const [now, setNow] = useState(new Date());

	useEffect(() => {
		const tick = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(tick);
	}, []);

	useEffect(() => {
		const token = localStorage.getItem('token');

		const fetchHospitals = async () => {
			try {
				const res = await fetch(`${API}/api/dispatch/hospitals`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) setHospitals(await res.json());
			} catch (err) {
				console.error('hospitals failed', err);
			}
		};

		const fetchActive = async () => {
			try {
				const res = await fetch(`${API}/api/dispatch/active`, {
					headers: { Authorization: `Bearer ${token}` },
				});
				if (res.ok) {
					const data = await res.json();
					const grouped = {};
					data.forEach((i) => {
						const hid = i.assignedHospital?._id;
						if (!hid) return;
						if (!grouped[hid]) grouped[hid] = [];
						grouped[hid].push(i);
					});
					setIncomingByHospital(grouped);
				}
			} catch (err) {
				console.error('active failed', err);
			}
		};

		fetchHospitals();
		fetchActive();

		const socket = io(API, { transports: ['polling'], auth: { token } });

		socket.on('hospitalPreAlert', (payload) => {
			const hid = payload.hospital?._id;
			if (!hid) return;
			setIncomingByHospital((prev) => {
				const list = prev[hid] || [];
				const exists = list.find((i) => i._id === payload.incident?._id);
				if (exists) return prev;
				return { ...prev, [hid]: [payload.incident, ...list] };
			});
		});

		socket.on('incidentStatusUpdate', (incident) => {
			if (['handover_complete', 'closed'].includes(incident.status)) {
				const hid = incident.assignedHospital?._id || incident.assignedHospital;
				if (!hid) return;
				setIncomingByHospital((prev) => ({
					...prev,
					[hid]: (prev[hid] || []).filter((i) => i._id !== incident._id),
				}));
			}
		});

		socket.on('incidentRerouted', (incident) => {
			// Refresh active to recalc groupings
			fetchActive();
		});

		socket.on('dispatchAssigned', () => fetchActive());

		return () => socket.disconnect();
	}, []);

	const ts = now.toLocaleString('en-GB', { hour12: false });

	return (
		<div className="his-page">
			<header className="his-header">
				<div>
					<h1>WeCare HIS · Bed Operations Terminal</h1>
					<p>Sys ID: HIS-RVITM-01 · Build 3.2.1 · Operator: SYSTEM</p>
				</div>
				<div className="his-clock">{ts}</div>
			</header>

			<div className="his-banner">
				<span className="dot" /> WeWooWeWoo Coordination Overlay · ATTACHED · receiving live pre-alerts
			</div>

			<div className="his-grid">
				{hospitals.map((h) => {
					const incoming = incomingByHospital[h._id] || [];
					const cap = h.capacity || {};
					const erTotal = cap.erBeds || 0;
					const erFree = cap.erBedsAvailable ?? 0;
					const icuTotal = cap.icuBeds || 0;
					const icuFree = cap.icuBedsAvailable ?? 0;
					const trauma = cap.traumaBaysAvailable ?? 0;
					const loadPct = Math.round((h.load || 0) * 100);
					const teams = h.teamsOnCall || {};
					return (
						<div key={h._id} className="his-card">
							<div className="his-card-header">
								<h2>{h.name}</h2>
								<span className={`load-pill load-${loadPct >= 70 ? 'hi' : loadPct <= 30 ? 'lo' : 'mid'}`}>
									LOAD {loadPct}%
								</span>
							</div>
							<p className="his-addr">{h.location?.address || ''}</p>

							<div className="bed-grid">
								<BedBlock label="ER BEDS" free={erFree} total={erTotal} />
								<BedBlock label="ICU" free={icuFree} total={icuTotal} />
								<BedBlock label="TRAUMA BAY" free={trauma} total={trauma > 0 ? trauma : 0} />
							</div>

							<div className="his-teams">
								<strong>ON-CALL</strong>
								<div className="team-row">
									<TeamLamp on={teams.cardiac} label="CARDIAC" />
									<TeamLamp on={teams.stroke} label="STROKE" />
									<TeamLamp on={teams.trauma} label="TRAUMA" />
									<TeamLamp on={teams.neuro} label="NEURO" />
								</div>
							</div>

							<div className="his-incoming">
								<strong>INCOMING ({incoming.length})</strong>
								{incoming.length === 0 ? (
									<p className="empty">— no inbound units —</p>
								) : (
									incoming.slice(0, 4).map((i) => (
										<div key={i._id} className="incoming-row">
											<span className="inc-cat">{i.category || 'general'}</span>
											<span className="inc-id">#{i._id?.slice(-6)}</span>
											<span className="inc-eta">
												{i.etaMinutes != null ? `${i.etaMinutes}m` : '—'}
											</span>
											<span className="inc-status">{i.status}</span>
										</div>
									))
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};

const BedBlock = ({ label, free, total }) => {
	const cells = Math.max(0, total);
	return (
		<div className="bed-block">
			<div className="bed-label">{label}</div>
			<div className="bed-cells">
				{Array.from({ length: cells }).map((_, idx) => (
					<span
						key={idx}
						className={`bed-cell ${idx < free ? 'free' : 'used'}`}
					/>
				))}
			</div>
			<div className="bed-count">{free}/{total}</div>
		</div>
	);
};

const TeamLamp = ({ on, label }) => (
	<span className={`team-lamp ${on ? 'on' : 'off'}`}>
		<i /> {label}
	</span>
);

export default HISPage;
