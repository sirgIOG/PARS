import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentLocation } from '../utils/locationUtils.js';
import '../styles/CallerPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CallerPage = () => {
	const [formData, setFormData] = useState({
		patientName: '',
		patientAge: '',
		patientSex: '',
		callerPhone: '',
		chiefComplaint: '',
		symptoms: '',
		address: '',
		location: { lat: null, lng: null }
	});

	const [submitting, setSubmitting] = useState(false);
	const [submission, setSubmission] = useState(null);
	const [error, setError] = useState('');
	const [locating, setLocating] = useState(false);

	const handleChange = (e) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleGetLocation = async () => {
		setError('');
		setLocating(true);
		try {
			const location = await getCurrentLocation();
			setFormData((prev) => ({ ...prev, location }));
		} catch (err) {
			setError('Unable to access location. Please enable permissions.');
		} finally {
			setLocating(false);
		}
	};

	const handleRVITMFallback = () => {
		setFormData((prev) => ({
			...prev,
			location: { lat: 12.9116, lng: 77.5006 },
			address: prev.address || 'RVITM Main Gate, Mysore Road, Bangalore'
		}));
	};

	const handleSubmit = async (e) => {
		e.preventDefault();
		setError('');
		setSubmitting(true);

		if (!formData.chiefComplaint || !formData.location.lat || !formData.location.lng) {
			setError('Chief complaint and location are required.');
			setSubmitting(false);
			return;
		}

		try {
			const response = await fetch(`${API}/api/calls`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					patientName: formData.patientName,
					patientAge: formData.patientAge ? parseInt(formData.patientAge) : undefined,
					patientSex: formData.patientSex || undefined,
					callerPhone: formData.callerPhone,
					chiefComplaint: formData.chiefComplaint,
					symptoms: formData.symptoms.split(',').map(s => s.trim()).filter(Boolean),
					location: {
						lat: formData.location.lat,
						lng: formData.location.lng,
						address: formData.address
					}
				})
			});

			const data = await response.json();

			if (response.ok) {
				setSubmission(data);
				setFormData({
					patientName: '',
					patientAge: '',
					patientSex: '',
					callerPhone: '',
					chiefComplaint: '',
					symptoms: '',
					address: '',
					location: { lat: null, lng: null }
				});
			} else {
				setError(data.error || 'Failed to submit call.');
			}
		} catch (err) {
			setError('Network error. Please try again.');
		} finally {
			setSubmitting(false);
		}
	};

	const filledFields = [
		formData.patientName,
		formData.patientAge,
		formData.patientSex,
		formData.callerPhone,
		formData.chiefComplaint,
		formData.symptoms,
		formData.address,
		formData.location.lat
	].filter(Boolean).length;

	return (
		<div className="caller-page">
			<div className="caller-layout">
				{/* Left sidebar — live summary */}
				<aside className="caller-sidebar">
					<Link to="/login" className="back-to-login">← Back to Login</Link>
					<div className="sidebar-header">
						<h1>Report an Emergency</h1>
						<p>Fill in what you know. We'll get help moving right away.</p>
					</div>

					<div className="sidebar-card">
						<div className="sidebar-card-title">Live Summary</div>
						<div className="summary-rows">
							<div className="summary-row">
								<span className="summary-label">Location</span>
								<span className={`summary-value ${formData.location.lat ? 'captured' : 'missing'}`}>
									{formData.location.lat
										? `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}`
										: 'Missing'}
								</span>
							</div>
							<div className="summary-row">
								<span className="summary-label">Complaint</span>
								<span className={`summary-value ${formData.chiefComplaint ? 'captured' : 'missing'}`}>
									{formData.chiefComplaint || 'Waiting...'}
								</span>
							</div>
							<div className="summary-row">
								<span className="summary-label">Patient</span>
								<span className={`summary-value ${formData.patientName ? 'captured' : 'missing'}`}>
									{formData.patientName || 'Unknown'}
								</span>
							</div>
							<div className="summary-row">
								<span className="summary-label">Phone</span>
								<span className={`summary-value ${formData.callerPhone ? 'captured' : 'missing'}`}>
									{formData.callerPhone || 'Not provided'}
								</span>
							</div>
						</div>
					</div>

					<div className="sidebar-card">
						<div className="sidebar-card-title">GPS Coordinates</div>
						<div className="coord-grid">
							<div className="coord-box">
								<span className="coord-label">Lat</span>
								<span className="coord-value">{formData.location.lat ? formData.location.lat.toFixed(5) : '--'}</span>
							</div>
							<div className="coord-box">
								<span className="coord-label">Lng</span>
								<span className="coord-value">{formData.location.lng ? formData.location.lng.toFixed(5) : '--'}</span>
							</div>
						</div>
						<div className="location-btn-group">
							<button type="button" className="location-btn" onClick={handleGetLocation} disabled={locating}>
								{locating ? '📡 Locating...' : '📡 Capture GPS'}
							</button>
							<button type="button" className="location-btn secondary" onClick={handleRVITMFallback}>
								📍 Use RVITM Gate
							</button>
						</div>
					</div>

					<div className="sidebar-progress">
						<div className="progress-label">Form Progress</div>
						<div className="progress-track">
							<div className="progress-fill" style={{ width: `${(filledFields / 8) * 100}%` }} />
						</div>
						<span className="progress-text">{filledFields} of 8 fields completed</span>
					</div>
				</aside>

				{/* Right — form */}
				<main className="caller-main">
					<form className="caller-form" onSubmit={handleSubmit}>
						<h2 className="form-title">Caller Information</h2>

						{error && <div className="form-error">{error}</div>}
						{submission && (
							<div className="form-success">
								✅ Call created. Incident ID: <strong>{submission._id?.slice(-6)}</strong>
								{submission.category && (
									<span className="submission-cat"> · Category: <strong>{submission.category}</strong></span>
								)}
							</div>
						)}

						<div className="form-grid">
							<div className="form-group">
								<label>Patient Name</label>
								<input
									type="text"
									name="patientName"
									value={formData.patientName}
									onChange={handleChange}
									placeholder="Full name"
								/>
							</div>
							<div className="form-group">
								<label>Age</label>
								<input
									type="number"
									name="patientAge"
									value={formData.patientAge}
									onChange={handleChange}
									placeholder="Age"
									min="0"
									max="120"
								/>
							</div>
							<div className="form-group">
								<label>Sex</label>
								<select name="patientSex" value={formData.patientSex} onChange={handleChange}>
									<option value="">Select</option>
									<option value="Male">Male</option>
									<option value="Female">Female</option>
									<option value="Other">Other</option>
								</select>
							</div>
							<div className="form-group">
								<label>Caller Phone</label>
								<input
									type="text"
									name="callerPhone"
									value={formData.callerPhone}
									onChange={handleChange}
									placeholder="Contact number"
								/>
							</div>
						</div>

						<div className="form-group">
							<label>Chief Complaint <span className="required">*</span></label>
							<textarea
								name="chiefComplaint"
								value={formData.chiefComplaint}
								onChange={handleChange}
								placeholder="Describe the emergency — e.g. chest pain radiating to left arm"
								required
								rows={3}
							/>
						</div>

						<div className="form-group">
							<label>Symptoms <span className="field-hint">(comma-separated)</span></label>
							<input
								type="text"
								name="symptoms"
								value={formData.symptoms}
								onChange={handleChange}
								placeholder="Chest pain, dizziness, shortness of breath"
							/>
						</div>

						<div className="form-group">
							<label>Address / Landmark</label>
							<input
								type="text"
								name="address"
								value={formData.address}
								onChange={handleChange}
								placeholder="Street address, landmark, or building name"
							/>
						</div>

						<button type="submit" className="submit-btn" disabled={submitting}>
							{submitting ? 'Submitting Call...' : '🚨 Submit Emergency Call'}
						</button>
					</form>
				</main>
			</div>
		</div>
	);
};

export default CallerPage;
