import { useState } from 'react';
import '../styles/AdminRegisterPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AdminHospitalRegisterPage = () => {
    const [formData, setFormData] = useState({
        hospital: {
            name: '',
            location: { lat: '', lng: '', address: '' },
            capabilities: {
                trauma: false,
                cardiac: false,
                pediatric: false,
                neurology: false,
                icu: true
            },
            level: 1,
            capacity: { erBeds: 20, icuBeds: 6 }
        },
        account: {
            name: '',
            email: '',
            password: '',
            phone: ''
        }
    });
    const [status, setStatus] = useState({ type: '', message: '' });
    const [submitting, setSubmitting] = useState(false);

    const updateNested = (path, value) => {
        setFormData((prev) => {
            const updated = { ...prev };
            let current = updated;
            for (let i = 0; i < path.length - 1; i += 1) {
                current[path[i]] = { ...current[path[i]] };
                current = current[path[i]];
            }
            current[path[path.length - 1]] = value;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus({ type: '', message: '' });
        setSubmitting(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API}/api/admin/hospitals/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    hospital: {
                        ...formData.hospital,
                        location: {
                            lat: parseFloat(formData.hospital.location.lat),
                            lng: parseFloat(formData.hospital.location.lng),
                            address: formData.hospital.location.address
                        },
                        level: parseInt(formData.hospital.level),
                        capacity: {
                            erBeds: parseInt(formData.hospital.capacity.erBeds),
                            icuBeds: parseInt(formData.hospital.capacity.icuBeds)
                        }
                    },
                    account: formData.account
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setStatus({ type: 'error', message: data.error || 'Failed to register hospital' });
            } else {
                setStatus({ type: 'success', message: 'Hospital and account created successfully.' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Network error. Please try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="admin-register-page">
            <header className="register-header">
                <div>
                    <h1>Register Hospital</h1>
                    <p>Create a hospital record with a login account in one step.</p>
                </div>
            </header>

            <form className="register-form" onSubmit={handleSubmit}>
                {status.message && (
                    <div className={`register-alert ${status.type}`}>{status.message}</div>
                )}

                <section className="form-section">
                    <h2>Hospital Details</h2>
                    <div className="form-grid">
                        <label>
                            Hospital Name
                            <input
                                type="text"
                                value={formData.hospital.name}
                                onChange={(e) => updateNested(['hospital', 'name'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Level (1-5)
                            <input
                                type="number"
                                min="1"
                                max="5"
                                value={formData.hospital.level}
                                onChange={(e) => updateNested(['hospital', 'level'], e.target.value)}
                            />
                        </label>
                        <label>
                            Latitude
                            <input
                                type="number"
                                step="0.00001"
                                value={formData.hospital.location.lat}
                                onChange={(e) => updateNested(['hospital', 'location', 'lat'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Longitude
                            <input
                                type="number"
                                step="0.00001"
                                value={formData.hospital.location.lng}
                                onChange={(e) => updateNested(['hospital', 'location', 'lng'], e.target.value)}
                                required
                            />
                        </label>
                        <label className="full">
                            Address
                            <input
                                type="text"
                                value={formData.hospital.location.address}
                                onChange={(e) => updateNested(['hospital', 'location', 'address'], e.target.value)}
                            />
                        </label>
                        <label>
                            ER Beds
                            <input
                                type="number"
                                min="0"
                                value={formData.hospital.capacity.erBeds}
                                onChange={(e) => updateNested(['hospital', 'capacity', 'erBeds'], e.target.value)}
                            />
                        </label>
                        <label>
                            ICU Beds
                            <input
                                type="number"
                                min="0"
                                value={formData.hospital.capacity.icuBeds}
                                onChange={(e) => updateNested(['hospital', 'capacity', 'icuBeds'], e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="checkbox-grid">
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.hospital.capabilities.trauma}
                                onChange={(e) => updateNested(['hospital', 'capabilities', 'trauma'], e.target.checked)}
                            />
                            Trauma Care
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.hospital.capabilities.cardiac}
                                onChange={(e) => updateNested(['hospital', 'capabilities', 'cardiac'], e.target.checked)}
                            />
                            Cardiac
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.hospital.capabilities.pediatric}
                                onChange={(e) => updateNested(['hospital', 'capabilities', 'pediatric'], e.target.checked)}
                            />
                            Pediatric
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.hospital.capabilities.neurology}
                                onChange={(e) => updateNested(['hospital', 'capabilities', 'neurology'], e.target.checked)}
                            />
                            Neurology
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={formData.hospital.capabilities.icu}
                                onChange={(e) => updateNested(['hospital', 'capabilities', 'icu'], e.target.checked)}
                            />
                            ICU
                        </label>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Hospital Login Account</h2>
                    <div className="form-grid">
                        <label>
                            Admin Name
                            <input
                                type="text"
                                value={formData.account.name}
                                onChange={(e) => updateNested(['account', 'name'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Email
                            <input
                                type="email"
                                value={formData.account.email}
                                onChange={(e) => updateNested(['account', 'email'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Password
                            <input
                                type="password"
                                value={formData.account.password}
                                onChange={(e) => updateNested(['account', 'password'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Phone
                            <input
                                type="text"
                                value={formData.account.phone}
                                onChange={(e) => updateNested(['account', 'phone'], e.target.value)}
                            />
                        </label>
                    </div>
                </section>

                <button className="submit-btn" type="submit" disabled={submitting}>
                    {submitting ? 'Creating Hospital...' : 'Create Hospital'}
                </button>
            </form>
        </div>
    );
};

export default AdminHospitalRegisterPage;
