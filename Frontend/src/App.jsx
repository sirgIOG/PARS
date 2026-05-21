import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import AmbulancePage from './pages/AmbulancePage'
import AmbulanceSessionPage from './pages/AmbulanceSessionPage'
import HospitalPage from './pages/HospitalPage'
import AdminPage from './pages/AdminPage'
import AdminHospitalRegisterPage from './pages/AdminHospitalRegisterPage'
import AdminAmbulanceRegisterPage from './pages/AdminAmbulanceRegisterPage'
import CallerPage from './pages/CallerPage'
import DispatcherPage from './pages/DispatcherPage'
import HISPage from './pages/HISPage'
import SimulationPage from './pages/SimulationPage'
import './App.css'

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  )
}

function AppShell() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {user && (
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-logo">
               Ambulance Management System
            </Link>
            <ul className="nav-menu">
              {(user.role === 'paramedic' || user.role === 'driver') && (
                <li className="nav-item">
                  <Link to="/ambulance" className="nav-link">
                     Ambulance
                  </Link>
                </li>
              )}
              {user.role === 'dispatcher' && (
                <li className="nav-item">
                  <Link to="/dispatcher" className="nav-link">
                     Dispatcher
                  </Link>
                </li>
              )}
              {(user.role === 'hospital' || user.role === 'admin') && (
                <li className="nav-item">
                  <Link to="/hospital" className="nav-link">
                     Hospital
                  </Link>
                </li>
              )}
              {(user.role === 'hospital' || user.role === 'admin' || user.role === 'dispatcher') && (
                <li className="nav-item">
                  <Link to="/his" className="nav-link">
                    HIS
                  </Link>
                </li>
              )}
              {user.role === 'admin' && (
                <li className="nav-item">
                  <Link to="/admin" className="nav-link">
                    ️ Admin
                  </Link>
                </li>
              )}
              {user.role === 'admin' && (
                <li className="nav-item">
                  <Link to="/admin/hospitals/new" className="nav-link">
                    + Hospital
                  </Link>
                </li>
              )}
              {user.role === 'admin' && (
                <li className="nav-item">
                  <Link to="/admin/ambulances/new" className="nav-link">
                    + Ambulance
                  </Link>
                </li>
              )}
              <li className="nav-item user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </li>
              <li className="nav-item">
                <button className="logout-btn" onClick={handleLogout}>
                  Logout
                </button>
              </li>
            </ul>
          </div>
        </nav>
      )}

      <Routes>
        <Route path="/caller" element={<CallerPage />} />
        <Route path="/simulation" element={<SimulationPage />} />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate
                to={
                  user.role === 'admin'
                    ? '/admin'
                    : user.role === 'hospital'
                    ? '/hospital'
                    : user.role === 'dispatcher'
                    ? '/dispatcher'
                    : '/ambulance'
                }
              />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          }
        />
        <Route 
          path="/" 
          element={
            user ? (
               <Navigate
                to={
                  user.role === 'admin'
                    ? '/admin'
                    : user.role === 'hospital'
                    ? '/hospital'
                    : user.role === 'dispatcher'
                    ? '/dispatcher'
                    : '/ambulance'
                }
              />
            ) : (
              <Navigate to="/login" />
            )
          } 
        />
        <Route
          path="/ambulance"
          element={(user?.role === 'paramedic' || user?.role === 'driver') ? <AmbulancePage /> : <Navigate to="/login" />}
        />
        <Route
          path="/ambulance/session"
          element={(user?.role === 'paramedic' || user?.role === 'driver') ? <AmbulanceSessionPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/dispatcher"
          element={user?.role === 'dispatcher' ? <DispatcherPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/hospital"
          element={user && ['hospital', 'admin'].includes(user.role) ? <HospitalPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/his"
          element={user && ['hospital', 'admin', 'dispatcher'].includes(user.role) ? <HISPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin"
          element={user?.role === 'admin' ? <AdminPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin/hospitals/new"
          element={user?.role === 'admin' ? <AdminHospitalRegisterPage /> : <Navigate to="/login" />}
        />
        <Route
          path="/admin/ambulances/new"
          element={user?.role === 'admin' ? <AdminAmbulanceRegisterPage /> : <Navigate to="/login" />}
        />
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} />} />
      </Routes>
    </>
  )
}

// Home page removed since users are directly routed to their dashboards
export default App
