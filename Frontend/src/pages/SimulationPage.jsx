import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './SimulationPage.css';

// ── Real Bangalore coordinates ──────────────────────────────────────
const LOCATIONS = {
    vegacity:   { lat: 13.0181, lng: 77.5508, name: 'Vegacity Mall (Ambulance Base)' },
    rvitm:      { lat: 12.9116, lng: 77.5006, name: 'RVITM Gate (Patient)' },
    bgs:        { lat: 12.9081, lng: 77.5496, name: 'BGS Global Hospital (Primary)' },
    fortis:     { lat: 12.9247, lng: 77.6002, name: 'Fortis Hospital (Alt 1)' },
    apollo:     { lat: 12.9361, lng: 77.6056, name: 'Apollo Spectra (Alt 2)' },
    maniPal:    { lat: 12.9280, lng: 77.5957, name: 'Manipal Hospital (Alt 3)' },
    // Second + third ambulances at different bases
    amb2base:   { lat: 12.9665, lng: 77.5933, name: 'AMB-002 Base (Indiranagar)' },
    amb3base:   { lat: 12.8945, lng: 77.5960, name: 'AMB-003 Base (BTM)' },
    // Hypothetical second call
    call2:      { lat: 12.9750, lng: 77.6100, name: 'Second Call (Koramangala)' },
};

// Generate intermediate waypoints along a path
const interpolate = (a, b, steps) => {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        pts.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
    }
    return pts;
};

// Full route: Vegacity → RVITM (patient) → BGS (hospital)
const ROUTE_PHASE1 = interpolate(LOCATIONS.vegacity, LOCATIONS.rvitm, 60);
const ROUTE_PHASE2 = interpolate(LOCATIONS.rvitm, LOCATIONS.bgs, 60);
const FULL_ROUTE = [...ROUTE_PHASE1, ...ROUTE_PHASE2];

// What-if: AMB-002 handles call2 simultaneously
const ROUTE_AMB2 = interpolate(LOCATIONS.amb2base, LOCATIONS.call2, 60);

const PHASE_LABELS = [
    { step: 0,   label: '🟡 Incident reported at RVITM', detail: 'Call received by dispatcher. ESI scored.' },
    { step: 15,  label: '🚑 AMB-001 dispatched', detail: 'Vegacity → RVITM. GPS tracking active.' },
    { step: 60,  label: '📍 On scene — patient loaded', detail: 'Paramedic begins vitals assessment.' },
    { step: 90,  label: '🏥 Transporting → BGS Global', detail: 'Nearest specialty hospital selected.' },
    { step: 120, label: '✅ Handover complete', detail: 'Bed pre-alerted. HIS notified.' },
];

export default function SimulationPage() {
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const amb1Marker = useRef(null);
    const amb2Marker = useRef(null);
    const amb3Marker = useRef(null);
    const routeLine = useRef(null);
    const travelledLine = useRef(null);
    const amb2Line = useRef(null);
    const intervalRef = useRef(null);

    const [step, setStep] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [showFleet, setShowFleet] = useState(false);
    const [currentPhase, setCurrentPhase] = useState(PHASE_LABELS[0]);
    const [speed, setSpeed] = useState(1);
    const totalSteps = FULL_ROUTE.length - 1;

    // ── Compute current phase label ──────────────────────────────────
    const getPhaseFor = (s) => {
        let cur = PHASE_LABELS[0];
        for (const p of PHASE_LABELS) { if (s >= p.step) cur = p; }
        return cur;
    };

    // ── Map init ─────────────────────────────────────────────────────
    useEffect(() => {
        if (mapInstance.current) return;
        const map = L.map(mapRef.current, {
            center: [12.9600, 77.5700],
            zoom: 12,
            zoomControl: true,
            attributionControl: false,
        });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OSM',
        }).addTo(map);
        mapInstance.current = map;

        // ── Static markers ──────────────────────────────────────────

        const makePin = (color, emoji) => L.divIcon({
            className: '',
            html: `<div class="sim-pin" style="background:${color}">${emoji}</div>`,
            iconSize: [32, 32], iconAnchor: [16, 16],
        });

        // Patient
        L.marker([LOCATIONS.rvitm.lat, LOCATIONS.rvitm.lng], { icon: makePin('#ef4444', '🆘') })
            .addTo(map).bindPopup('<b>Patient — RVITM Gate</b><br>Chest pain + collapse');

        // Hospitals
        [
            { loc: LOCATIONS.bgs,     label: 'BGS Global Hospital',  emoji: '🏥', c: '#22c55e', note: 'PRIMARY — 8 min ETA · 3 CICU beds' },
            { loc: LOCATIONS.fortis,  label: 'Fortis Hospital',       emoji: '🏨', c: '#3b82f6', note: 'Alt 1 — 14 min ETA · Full capacity' },
            { loc: LOCATIONS.apollo,  label: 'Apollo Spectra',        emoji: '🏨', c: '#a855f7', note: 'Alt 2 — 16 min ETA · 2 ICU beds' },
            { loc: LOCATIONS.maniPal, label: 'Manipal Hospital',      emoji: '🏨', c: '#ec4899', note: 'Alt 3 — 18 min ETA · 1 ICU bed'  },
        ].forEach(({ loc, label, emoji, c, note }) => {
            L.marker([loc.lat, loc.lng], { icon: makePin(c, emoji) })
                .addTo(map).bindPopup(`<b>${label}</b><br>${note}`);
            // Capacity radius circle
            L.circle([loc.lat, loc.lng], {
                radius: 800, color: c, weight: 1,
                fillColor: c, fillOpacity: 0.06,
            }).addTo(map);
        });

        // Ambulance base — vegacity
        L.marker([LOCATIONS.vegacity.lat, LOCATIONS.vegacity.lng], { icon: makePin('#f59e0b', '🚑') })
            .addTo(map).bindPopup('<b>AMB-001 — Vegacity Mall Base</b>');

        // Fleet ambiance — AMB-002 and AMB-003 bases
        L.marker([LOCATIONS.amb2base.lat, LOCATIONS.amb2base.lng], { icon: makePin('#6366f1', '🚑') })
            .addTo(map).bindPopup('<b>AMB-002 — Indiranagar Base</b><br>Status: Standby');
        L.marker([LOCATIONS.amb3base.lat, LOCATIONS.amb3base.lng], { icon: makePin('#06b6d4', '🚑') })
            .addTo(map).bindPopup('<b>AMB-003 — BTM Base</b><br>Status: Available');

        // Second call marker (initially hidden)
        L.marker([LOCATIONS.call2.lat, LOCATIONS.call2.lng], { icon: makePin('#fb923c', '📞'), opacity: 0.5 })
            .addTo(map).bindPopup('<b>Incoming Call — Koramangala</b><br>Dispatch AMB-002?');

        // Full planned route line (grey dashed)
        L.polyline(FULL_ROUTE.map(p => [p.lat, p.lng]), {
            color: '#6366f1', weight: 2.5, opacity: 0.35, dashArray: '6 6',
        }).addTo(map);

        // Travelling line (filled as ambulance moves)
        travelledLine.current = L.polyline([], {
            color: '#22d3ee', weight: 4, opacity: 0.9,
        }).addTo(map);

        // AMB-001 moving marker (starts at vegacity)
        amb1Marker.current = L.marker(
            [LOCATIONS.vegacity.lat, LOCATIONS.vegacity.lng],
            { icon: makePin('#22d3ee', '🚑'), zIndexOffset: 1000 }
        ).addTo(map).bindPopup('<b>AMB-001</b> — En Route');

        // AMB-002 moving marker
        amb2Marker.current = L.marker(
            [LOCATIONS.amb2base.lat, LOCATIONS.amb2base.lng],
            { icon: makePin('#a78bfa', '🚑'), zIndexOffset: 999 }
        ).addTo(map).bindPopup('<b>AMB-002</b> — What-if dispatch to Koramangala');

        // AMB-003 static available
        amb3Marker.current = L.marker(
            [LOCATIONS.amb3base.lat, LOCATIONS.amb3base.lng],
            { icon: makePin('#34d399', '🚑'), zIndexOffset: 998 }
        ).addTo(map).bindPopup('<b>AMB-003</b> — Available');

        return () => { map.remove(); mapInstance.current = null; };
    }, []);

    // ── Animate on step change ───────────────────────────────────────
    useEffect(() => {
        const map = mapInstance.current;
        if (!map) return;

        // AMB-001 position
        const pos = FULL_ROUTE[Math.min(step, totalSteps)];
        if (pos && amb1Marker.current) {
            amb1Marker.current.setLatLng([pos.lat, pos.lng]);
        }

        // Travelled line
        if (travelledLine.current) {
            travelledLine.current.setLatLngs(
                FULL_ROUTE.slice(0, step + 1).map(p => [p.lat, p.lng])
            );
        }

        // AMB-002 — moves if showFleet is on and step >= 30
        if (showFleet && amb2Marker.current) {
            const s2 = Math.max(0, step - 30);
            const pos2 = ROUTE_AMB2[Math.min(s2, ROUTE_AMB2.length - 1)];
            if (pos2) amb2Marker.current.setLatLng([pos2.lat, pos2.lng]);
        }

        // Phase label
        setCurrentPhase(getPhaseFor(step));
    }, [step, showFleet]);

    // ── Playback controls ────────────────────────────────────────────
    useEffect(() => {
        if (playing) {
            intervalRef.current = setInterval(() => {
                setStep(s => {
                    if (s >= totalSteps) { setPlaying(false); return s; }
                    return s + 1;
                });
            }, 120 / speed);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [playing, speed]);

    const reset = () => { setPlaying(false); setStep(0); };

    const pct = Math.round((step / totalSteps) * 100);
    const isOnRoute1 = step < ROUTE_PHASE1.length;

    return (
        <div className="sim-page">
            {/* ── Hero header ─────────────────────────────────── */}
            <header className="sim-header">
                <div className="sim-header-left">
                    <Link to="/login" className="sim-back">← Back to login</Link>
                    <h1 className="sim-title">
                        <span className="sim-title-accent">WeWooWeWoo</span>
                        &nbsp;Live Routing Simulation
                    </h1>
                    <p className="sim-subtitle">
                        Vegacity Mall → RVITM Patient → BGS Global Hospital ·
                        Fleet-aware dispatch · AI risk scoring
                    </p>
                </div>
                <div className="sim-header-right">
                    <span className={`sim-badge ${isOnRoute1 ? 'amber' : 'green'}`}>
                        {step === 0 ? 'IDLE' : step < ROUTE_PHASE1.length ? 'EN ROUTE' : step < totalSteps ? 'TRANSPORTING' : 'COMPLETE'}
                    </span>
                </div>
            </header>

            {/* ── Main layout: map + panel ─────────────────────── */}
            <div className="sim-body">
                {/* Map */}
                <div className="sim-map-wrap">
                    <div ref={mapRef} className="sim-map" />

                    {/* Phase overlay on map */}
                    <div className="sim-phase-chip">
                        <div className="phase-label">{currentPhase.label}</div>
                        <div className="phase-detail">{currentPhase.detail}</div>
                    </div>
                </div>

                {/* Side panel */}
                <aside className="sim-panel">

                    {/* Progress */}
                    <div className="sim-card">
                        <div className="sim-card-title">Mission Progress</div>
                        <div className="sim-progress-bar">
                            <div className="sim-progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="sim-progress-stats">
                            <span>{pct}% complete</span>
                            <span>~{Math.round((totalSteps - step) * 0.12 / speed)} sec remaining</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="sim-card">
                        <div className="sim-card-title">Simulation Controls</div>
                        <div className="sim-controls">
                            <button className="sim-btn play" onClick={() => setPlaying(p => !p)}>
                                {playing ? '⏸ Pause' : '▶ Play'}
                            </button>
                            <button className="sim-btn reset" onClick={reset}>⟳ Reset</button>
                        </div>
                        <div className="sim-speed">
                            <span>Speed: {speed}×</span>
                            <input type="range" min="1" max="5" value={speed}
                                onChange={e => setSpeed(Number(e.target.value))}
                                className="sim-slider" />
                        </div>
                        <label className="sim-toggle">
                            <input type="checkbox" checked={showFleet}
                                onChange={e => setShowFleet(e.target.checked)} />
                            <span>Show fleet what-if (AMB-002 dispatched simultaneously)</span>
                        </label>
                    </div>

                    {/* Phases */}
                    <div className="sim-card">
                        <div className="sim-card-title">Mission Timeline</div>
                        <div className="timeline">
                            {PHASE_LABELS.map((p, i) => (
                                <div key={i}
                                    className={`timeline-item ${step >= p.step ? 'done' : ''} ${step >= p.step && (PHASE_LABELS[i+1] ? step < PHASE_LABELS[i+1].step : true) ? 'current' : ''}`}
                                    onClick={() => setStep(p.step)}>
                                    <div className="tl-dot" />
                                    <div className="tl-body">
                                        <div className="tl-label">{p.label}</div>
                                        <div className="tl-detail">{p.detail}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hospital alternatives */}
                    <div className="sim-card">
                        <div className="sim-card-title">Hospital Selection</div>
                        {[
                            { name: 'BGS Global',    eta: 8,  beds: 3, score: 94, status: 'SELECTED',  c: '#22c55e' },
                            { name: 'Fortis',         eta: 14, beds: 0, score: 71, status: 'AT CAPACITY',c: '#ef4444' },
                            { name: 'Apollo Spectra', eta: 16, beds: 2, score: 68, status: 'AVAILABLE',  c: '#3b82f6' },
                            { name: 'Manipal',        eta: 18, beds: 1, score: 61, status: 'AVAILABLE',  c: '#a855f7' },
                        ].map(h => (
                            <div key={h.name} className="hosp-row" style={{ '--hc': h.c }}>
                                <div className="hosp-name">{h.name}</div>
                                <div className="hosp-meta">
                                    <span>{h.eta} min</span>
                                    <span>{h.beds} beds</span>
                                    <span className="hosp-score">AI: {h.score}</span>
                                    <span className="hosp-status" style={{ color: h.c }}>{h.status}</span>
                                </div>
                                <div className="hosp-bar">
                                    <div style={{ width: `${h.score}%`, background: h.c }} />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Fleet status */}
                    <div className="sim-card">
                        <div className="sim-card-title">Fleet Status</div>
                        {[
                            { id: 'AMB-001', status: step === 0 ? 'AVAILABLE' : step < ROUTE_PHASE1.length ? 'EN ROUTE' : step < totalSteps ? 'TRANSPORTING' : 'AVAILABLE', c: '#22d3ee' },
                            { id: 'AMB-002', status: showFleet && step >= 30 ? 'DISPATCHED' : 'STANDBY', c: '#a78bfa' },
                            { id: 'AMB-003', status: 'AVAILABLE', c: '#34d399' },
                        ].map(a => (
                            <div key={a.id} className="fleet-row">
                                <span className="fleet-id">🚑 {a.id}</span>
                                <span className="fleet-status" style={{ color: a.c }}>{a.status}</span>
                            </div>
                        ))}
                    </div>

                    {/* Scrubber */}
                    <div className="sim-card">
                        <div className="sim-card-title">Manual Scrub</div>
                        <input type="range" min="0" max={totalSteps} value={step}
                            onChange={e => { setPlaying(false); setStep(Number(e.target.value)); }}
                            className="sim-slider wide" />
                    </div>
                </aside>
            </div>
        </div>
    );
}
