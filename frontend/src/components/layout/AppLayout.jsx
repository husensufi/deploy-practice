import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext.jsx";
import GynoBuddyWidget from "../common/GynoBuddyWidget.jsx";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    setLogoutError("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Could not sign out. Please try again.");
    }
  }

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Link className="brand" to="/home">
          <span className="brand-mark" aria-hidden="true" />
          <span>Ashwini Asangi PCOS GynoCare</span>
        </Link>
        <nav className="portal-nav" aria-label="Main navigation">
          {user?.role === "admin" ? (
            <>
              <NavLink to="/admin">Dashboard</NavLink>
              <NavLink to="/admin">Patients</NavLink>
              <NavLink to="/admin">Doctors</NavLink>
              <NavLink to="/admin">Approvals</NavLink>
              <NavLink to="/admin">Reports</NavLink>
              <NavLink to="/admin/appointments">Appointments</NavLink>
            </>
          ) : (
            <>
              <NavLink to="/home">Dashboard</NavLink>
              <NavLink to="/connections">Friends &amp; family</NavLink>
              {user?.role === "patient" && (
                <>
                  <NavLink to="/assessment">Assessment</NavLink>
                  <NavLink to="/tracker">Daily tracker</NavLink>
                  <NavLink to="/reports">Reports</NavLink>
                  <NavLink to="/doctors">Doctors</NavLink>
                  <NavLink to="/appointments">Appointments</NavLink>
                  <NavLink to="/movement">Wellness</NavLink>
                </>
              )}
              {user?.role === "doctor" && (
                <>
                  <NavLink to="/doctor/profile">Clinic profile</NavLink>
                  <NavLink to="/doctor/appointments">Appointments</NavLink>
                </>
              )}
            </>
          )}
          <button type="button" className="nav-logout" onClick={handleLogout}>
            Log out
          </button>
        </nav>
      </header>
      {logoutError && <p className="page-error" role="alert">{logoutError}</p>}
      <main className="portal-content">
        <Outlet />
      </main>
      <GynoBuddyWidget />
    </div>
  );
}
