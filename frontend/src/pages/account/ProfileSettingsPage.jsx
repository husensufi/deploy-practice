import { useState } from "react";
import { KeyRound, Save, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../contexts/AuthContext.jsx";
import { apiRequest } from "../../services/api.js";

function getErrorMessage(error, fallback) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => item?.msg).filter(Boolean);
    if (messages.length) return messages.join(" ");
  }
  return fallback;
}

export default function ProfileSettingsPage({ mode }) {
  const { user, updateUser, endSession } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    full_name: user?.full_name || "",
    mobile: user?.mobile || "",
  });
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isPassword = mode === "password";

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");
    try {
      if (isPassword) {
        if (passwords.new_password !== passwords.confirm_new_password) {
          setError("New passwords do not match.");
          return;
        }
        if (
          passwords.new_password.length < 8
          || !/[a-z]/.test(passwords.new_password)
          || !/[A-Z]/.test(passwords.new_password)
          || !/\d/.test(passwords.new_password)
        ) {
          setError("Use at least 8 characters, including uppercase, lowercase, and a number.");
          return;
        }
        await apiRequest("/auth/password", { method: "POST", data: passwords });
        endSession();
        navigate("/login", { replace: true });
        return;
      }
      const account = await apiRequest("/auth/profile", {
        method: "PUT",
        data: { ...values, mobile: values.mobile.trim() || null },
      });
      updateUser(account);
      setMessage("Your profile has been updated.");
    } catch (requestError) {
      setError(getErrorMessage(requestError, "Could not save your changes. Please try again."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="content-page profile-settings-page">
      <header className="page-heading">
        <span className="eyebrow">Account settings</span>
        <h1>{isPassword ? "Change password" : "Edit profile"}</h1>
        <p>Manage your personal account information securely.</p>
      </header>
      <form className="form-card profile-settings-card" onSubmit={submit}>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="success-message" role="status">{message}</p>}
        {isPassword ? (
          <>
            <label className="form-field">
              Current password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={passwords.current_password}
                onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })}
              />
            </label>
            <label className="form-field">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={passwords.new_password}
                onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })}
              />
              <small>Use at least 8 characters, including uppercase, lowercase, and a number.</small>
            </label>
            <label className="form-field">
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={passwords.confirm_new_password}
                onChange={(event) => setPasswords({ ...passwords, confirm_new_password: event.target.value })}
              />
            </label>
          </>
        ) : (
          <>
            <label className="form-field">
              Full name
              <input
                autoComplete="name"
                maxLength={255}
                required
                value={values.full_name}
                onChange={(event) => setValues({ ...values, full_name: event.target.value })}
              />
            </label>
            <label className="form-field">
              Phone number
              <input
                autoComplete="tel"
                maxLength={50}
                value={values.mobile}
                onChange={(event) => setValues({ ...values, mobile: event.target.value })}
              />
            </label>
            <label className="form-field">
              Email address
              <input type="email" value={user?.email || ""} readOnly />
              <small>Email address changes are managed by an administrator.</small>
            </label>
          </>
        )}
        <div className="profile-settings-actions">
          <button className="button button-primary" type="submit" disabled={pending}>
            {isPassword ? <KeyRound size={17} aria-hidden="true" /> : <Save size={17} aria-hidden="true" />}
            {pending ? "Saving…" : isPassword ? "Update password" : "Save profile"}
          </button>
          <Link className="button button-secondary" to="/home">Cancel</Link>
        </div>
      </form>
    </section>
  );
}
