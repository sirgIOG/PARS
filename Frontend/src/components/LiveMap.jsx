import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default Leaflet marker icons don't work with bundlers.
// Use CDN URLs so the icons render without webpack/vite hacks.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
	iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
	shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const colorIcon = (color) =>
	L.divIcon({
		className: 'live-map-pin',
		html: `<div style="
			width: 18px; height: 18px;
			border-radius: 50%;
			background: ${color};
			border: 3px solid white;
			box-shadow: 0 0 0 1px ${color}, 0 2px 6px rgba(0,0,0,0.3);
		"></div>`,
		iconSize: [18, 18],
		iconAnchor: [9, 9],
	});

const ICONS = {
	ambulance: colorIcon('#2563eb'),
	ambulanceBusy: colorIcon('#f59e0b'),
	hospital: colorIcon('#10b981'),
	hospitalActive: colorIcon('#e63946'),
	incident: colorIcon('#ef4444'),
};

const LiveMap = ({
	center = [12.9116, 77.5006],
	zoom = 13,
	ambulances = [],
	hospitals = [],
	incidents = [],
	height = 380,
}) => {
	const containerRef = useRef(null);
	const mapRef = useRef(null);
	const markersRef = useRef({ ambulances: {}, hospitals: {}, incidents: {} });

	useEffect(() => {
		if (mapRef.current || !containerRef.current) return;
		const map = L.map(containerRef.current).setView(center, zoom);
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			attribution: '© OpenStreetMap',
			maxZoom: 19,
		}).addTo(map);
		mapRef.current = map;

		return () => {
			map.remove();
			mapRef.current = null;
			markersRef.current = { ambulances: {}, hospitals: {}, incidents: {} };
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Sync ambulance markers
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const seen = new Set();
		ambulances.forEach((a) => {
			const lat = a.lat ?? a.currentLocation?.lat;
			const lng = a.lng ?? a.currentLocation?.lng;
			if (lat == null || lng == null) return;
			const id = a.id || a._id || a.ambulanceId;
			if (!id) return;
			seen.add(id);
			const icon = a.busy ? ICONS.ambulanceBusy : ICONS.ambulance;
			const label = `🚑 ${a.code || a.ambulanceId || id}${a.status ? ` (${a.status})` : ''}`;
			let marker = markersRef.current.ambulances[id];
			if (marker) {
				marker.setLatLng([lat, lng]);
				marker.setIcon(icon);
				marker.bindPopup(label);
			} else {
				marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);
				markersRef.current.ambulances[id] = marker;
			}
		});

		// Remove stale ambulance markers
		Object.keys(markersRef.current.ambulances).forEach((id) => {
			if (!seen.has(id)) {
				map.removeLayer(markersRef.current.ambulances[id]);
				delete markersRef.current.ambulances[id];
			}
		});
	}, [ambulances]);

	// Sync hospital markers
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const seen = new Set();
		hospitals.forEach((h) => {
			const lat = h.lat ?? h.location?.lat;
			const lng = h.lng ?? h.location?.lng;
			if (lat == null || lng == null) return;
			const id = h.id || h._id;
			if (!id) return;
			seen.add(id);
			const icon = h.active ? ICONS.hospitalActive : ICONS.hospital;
			let marker = markersRef.current.hospitals[id];
			const label = `🏥 ${h.name || id}`;
			if (marker) {
				marker.setLatLng([lat, lng]);
				marker.setIcon(icon);
				marker.bindPopup(label);
			} else {
				marker = L.marker([lat, lng], { icon }).addTo(map).bindPopup(label);
				markersRef.current.hospitals[id] = marker;
			}
		});

		Object.keys(markersRef.current.hospitals).forEach((id) => {
			if (!seen.has(id)) {
				map.removeLayer(markersRef.current.hospitals[id]);
				delete markersRef.current.hospitals[id];
			}
		});
	}, [hospitals]);

	// Sync incident markers
	useEffect(() => {
		const map = mapRef.current;
		if (!map) return;

		const seen = new Set();
		incidents.forEach((i) => {
			const lat = i.lat ?? i.location?.lat;
			const lng = i.lng ?? i.location?.lng;
			if (lat == null || lng == null) return;
			const id = i.id || i._id;
			if (!id) return;
			seen.add(id);
			let marker = markersRef.current.incidents[id];
			const label = `📍 Incident ${id?.slice ? id.slice(-6) : id}${i.category ? ` · ${i.category}` : ''}`;
			if (marker) {
				marker.setLatLng([lat, lng]);
				marker.bindPopup(label);
			} else {
				marker = L.marker([lat, lng], { icon: ICONS.incident })
					.addTo(map)
					.bindPopup(label);
				markersRef.current.incidents[id] = marker;
			}
		});

		Object.keys(markersRef.current.incidents).forEach((id) => {
			if (!seen.has(id)) {
				map.removeLayer(markersRef.current.incidents[id]);
				delete markersRef.current.incidents[id];
			}
		});
	}, [incidents]);

	return (
		<div
			ref={containerRef}
			className="live-map-container"
			style={{ height, width: '100%', borderRadius: 16, overflow: 'hidden' }}
		/>
	);
};

export default LiveMap;
