import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import '../styles/LoginPage.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LoginPage = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Save token to localStorage
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                
                // Call callback
                onLoginSuccess(data.user);

                // Navigate based on role
                switch (data.user.role) {
                    case 'admin':
                        navigate('/admin');
                        break;
                    case 'hospital':
                        navigate('/hospital');
                        break;
                    case 'paramedic':
                    case 'driver':
                        navigate('/ambulance');
                        break;
                    case 'dispatcher':
                        navigate('/dispatcher');
                        break;
                    default:
                        navigate('/');
                }
            } else {
                setError(data.error || 'Login failed');
            }
        } catch (error) {
            console.error('Login error:', error);
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const demoAccounts = [
        { email: 'admin@hospital.com', password: 'admin123', role: 'Admin', desc: 'Full system access' },
        { email: 'dispatch@ems.com', password: 'dispatch123', role: 'Dispatcher', desc: 'Assign ambulances' },
        { email: 'paramedic@ambulance.com', password: 'para123', role: 'Ambulance', desc: 'Linked to unit' },
        { email: 'hospital@health.com', password: 'hosp123', role: 'Hospital', desc: 'Hospital dashboard' }
    ];

    const useDemoAccount = (demoEmail, demoPassword) => {
        setEmail(demoEmail);
        setPassword(demoPassword);
    };

    return (
        <div className="login-page">
            {/* ── Left: Video Hero ──────────────────────────── */}
            <div className="login-hero">
                <video
                    className="hero-video"
                    src="/demo.mp4"
                    autoPlay
                    muted
                    loop
                    playsInline
                />
                <div className="hero-overlay" />
                <div className="hero-content">
                    <div className="hero-badge">🚨 AI-Powered EMS</div>
                    <h2 className="hero-headline">
                        Pre-Hospital Intelligence<br />
                        <span className="hero-accent">at the speed of life</span>
                    </h2>
                    <p className="hero-body">
                        Real-time risk scoring · Fleet-aware dispatch ·
                        Hospital pre-alerting · Paramedic clinical protocols
                    </p>
                    <Link to="/simulation" className="hero-sim-btn">
                        ▶ Watch Live Routing Simulation
                    </Link>
                    <div className="hero-stats">
                        <div className="hstat"><span className="hstat-val">~8 min</span><span className="hstat-label">Avg ETA reduction</span></div>
                        <div className="hstat"><span className="hstat-val">ESI 1–5</span><span className="hstat-label">AI risk classified</span></div>
                        <div className="hstat"><span className="hstat-val">3</span><span className="hstat-label">Hospital options ranked</span></div>
                    </div>
                </div>
            </div>

            {/* ── Right: Login panel ────────────────────────── */}
            <div className="login-right">
                <div className="login-container">
                    <div className="login-header">
                        <h1>WeWooWeWoo 🚑</h1>
                        <p>Emergency Coordination Platform</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>Email</label>
                            <input type="email" value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com" required />
                        </div>

                        <div className="form-group">
                            <label>Password</label>
                            <input type="password" value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password" required />
                        </div>

                        <button type="submit" className="login-btn" disabled={loading}>
                            {loading ? 'Logging in...' : 'Login →'}
                        </button>
                    </form>

                    <div className="demo-section">
                        <h3>Quick Demo Access</h3>
                        <div className="demo-accounts">
                            {demoAccounts.map((account) => (
                                <button key={account.email} type="button"
                                    className="demo-btn"
                                    onClick={() => useDemoAccount(account.email, account.password)}>
                                    <span className="demo-role">{account.role}</span>
                                    <span className="demo-email">{account.email}</span>
                                    <span className="demo-desc">{account.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="demo-section">
                        <div className="login-links">
                            <button type="button" className="link-btn"
                                onClick={() => navigate('/caller')}>
                                📞 Open Caller Intake
                            </button>
                            <Link to="/simulation" className="link-btn sim">
                                🗺 Live Simulation
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
