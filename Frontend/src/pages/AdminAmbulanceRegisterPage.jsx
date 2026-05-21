import { useState } from 'react';
import '../styles/AdminRegisterPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AdminAmbulanceRegisterPage = () => {
    const [formData, setFormData] = useState({
        ambulance: {
            ambulanceId: '',
            numberPlate: '',
            driver: { name: '', phone: '', licenseNumber: '' },
            vehicle: { model: '', color: '', capacity: 4 },
            serviceLevel: 'BLS',
            contactNumber: ''
        },
        account: {
            name: '',
            email: '',
            password: '',
            role: 'paramedic',
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
            const response = await fetch(`${API}/api/admin/ambulances/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ambulance: {
                        ...formData.ambulance,
                        vehicle: {
                            ...formData.ambulance.vehicle,
                            capacity: parseInt(formData.ambulance.vehicle.capacity)
                        }
                    },
                    account: formData.account
                })
            });

            const data = await response.json();
            if (!response.ok) {
                setStatus({ type: 'error', message: data.error || 'Failed to register ambulance' });
            } else {
                setStatus({ type: 'success', message: 'Ambulance and account created successfully.' });
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
                    <h1>Register Ambulance</h1>
                    <p>Create an ambulance record with a paramedic/driver login.</p>
                </div>
            </header>

            <form className="register-form" onSubmit={handleSubmit}>
                {status.message && (
                    <div className={`register-alert ${status.type}`}>{status.message}</div>
                )}

                <section className="form-section">
                    <h2>Ambulance Details</h2>
                    <div className="form-grid">
                        <label>
                            Ambulance ID
                            <input
                                type="text"
                                value={formData.ambulance.ambulanceId}
                                onChange={(e) => updateNested(['ambulance', 'ambulanceId'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Number Plate
                            <input
                                type="text"
                                value={formData.ambulance.numberPlate}
                                onChange={(e) => updateNested(['ambulance', 'numberPlate'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Service Level
                            <select
                                value={formData.ambulance.serviceLevel}
                                onChange={(e) => updateNested(['ambulance', 'serviceLevel'], e.target.value)}
                            >
                                <option value="ALS">ALS</option>
                                <option value="BLS">BLS</option>
                            </select>
                        </label>
                        <label>
                            Contact Number
                            <input
                                type="text"
                                value={formData.ambulance.contactNumber}
                                onChange={(e) => updateNested(['ambulance', 'contactNumber'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Vehicle Model
                            <input
                                type="text"
                                value={formData.ambulance.vehicle.model}
                                onChange={(e) => updateNested(['ambulance', 'vehicle', 'model'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Vehicle Color
                            <input
                                type="text"
                                value={formData.ambulance.vehicle.color}
                                onChange={(e) => updateNested(['ambulance', 'vehicle', 'color'], e.target.value)}
                            />
                        </label>
                        <label>
                            Capacity
                            <input
                                type="number"
                                min="1"
                                value={formData.ambulance.vehicle.capacity}
                                onChange={(e) => updateNested(['ambulance', 'vehicle', 'capacity'], e.target.value)}
                            />
                        </label>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Driver Information</h2>
                    <div className="form-grid">
                        <label>
                            Driver Name
                            <input
                                type="text"
                                value={formData.ambulance.driver.name}
                                onChange={(e) => updateNested(['ambulance', 'driver', 'name'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            Driver Phone
                            <input
                                type="text"
                                value={formData.ambulance.driver.phone}
                                onChange={(e) => updateNested(['ambulance', 'driver', 'phone'], e.target.value)}
                                required
                            />
                        </label>
                        <label>
                            License Number
                            <input
                                type="text"
                                value={formData.ambulance.driver.licenseNumber}
                                onChange={(e) => updateNested(['ambulance', 'driver', 'licenseNumber'], e.target.value)}
                                required
                            />
                        </label>
                    </div>
                </section>

                <section className="form-section">
                    <h2>Ambulance Login Account</h2>
                    <div className="form-grid">
                        <label>
                            Staff Name
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
                            Role
                            <select
                                value={formData.account.role}
                                onChange={(e) => updateNested(['account', 'role'], e.target.value)}
                            >
                                <option value="paramedic">Paramedic</option>
                                <option value="driver">Driver</option>
                            </select>
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
                    {submitting ? 'Creating Ambulance...' : 'Create Ambulance'}
                </button>
            </form>
        </div>
    );
};

export default AdminAmbulanceRegisterPage;
