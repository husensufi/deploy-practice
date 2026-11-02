import { useState } from "react";
import { Bell, CircleUserRound, KeyRound, LogOut, UserRoundPen } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../../contexts/AuthContext.jsx";
import { apiRequest } from "../../services/api.js";
import GynoBuddyWidget from "../common/GynoBuddyWidget.jsx";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [logoutError, setLogoutError] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notifications = useQuery({
    queryKey: ["account-notifications"],
    queryFn: () => apiRequest("/auth/notifications"),
    refetchInterval: 60000,
    enabled: Boolean(user),
  });
  const markRead = useMutation({
    mutationFn: (id) => apiRequest(`/auth/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["account-notifications"] }),
  });

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
          <span>PCOS GynoCare</span>
        </Link>
        <nav className="portal-nav" aria-label="Main navigation">
          {user?.role === "admin" ? (
            <>
              <NavLink to="/admin" end>Dashboard</NavLink>
              <NavLink to="/admin/patients">Patients</NavLink>
              <NavLink to="/admin/doctors">Doctors</NavLink>
              <NavLink to="/admin/approvals">Approvals</NavLink>
              <NavLink to="/admin/reports">Reports</NavLink>
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
          <div className="nav-account-tools">
            <div className="notification-menu">
              <button
                type="button"
                className="nav-icon-button"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={19} aria-hidden="true" />
                {notifications.data?.filter((item) => !item.read_at).length > 0 && (
                  <span className="notification-count">
                    {notifications.data.filter((item) => !item.read_at).length}
                  </span>
                )}
              </button>
              {notificationsOpen && (
                <section className="account-dropdown notification-dropdown" aria-label="Notifications">
                  <strong>Notifications</strong>
                  {notifications.isLoading ? <p>Loading notifications…</p> : null}
                  {notifications.error ? <p role="alert">Could not load notifications.</p> : null}
                  {markRead.error ? <p role="alert">Could not mark the notification as read.</p> : null}
                  {!notifications.isLoading && !notifications.data?.length && <p>No notifications yet.</p>}
                  {notifications.data?.map((item) => (
                    <div className={`notification-item ${item.read_at ? "is-read" : ""}`} key={item.id}>
                      <p>{item.message}</p>
                      {!item.read_at && (
                        <button
                          type="button"
                          disabled={markRead.isPending}
                          onClick={() => markRead.mutate(item.id)}
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  ))}
                </section>
              )}
            </div>
            <details className="profile-menu">
              <summary aria-label="Open profile menu">
                <CircleUserRound size={23} aria-hidden="true" />
                <span className="profile-menu-name">{user?.full_name}</span>
              </summary>
              <div className="account-dropdown">
                <Link to="/profile/edit"><UserRoundPen size={16} aria-hidden="true" /> Edit Profile</Link>
                <Link to="/profile/password"><KeyRound size={16} aria-hidden="true" /> Change Password</Link>
                <button type="button" onClick={handleLogout}><LogOut size={16} aria-hidden="true" /> Logout</button>
              </div>
            </details>
          </div>
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
