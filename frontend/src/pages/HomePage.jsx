import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { LoadingState, ErrorState } from "../components/common/QueryState.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { apiRequest } from "../services/api.js";

function PatientDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["patient-dashboard"],
    queryFn: () => apiRequest("/patients/dashboard"),
  });

  if (isLoading) return <LoadingState label="Loading your dashboard..." />;
  if (error) return <ErrorState error={error} fallback="Could not load your health summary." />;

  const screening = data.screening_result;
  const today = data.today_log;
  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">Patient portal</span>
        <h1>Welcome, {user.full_name}</h1>
        <p>Your health information and next steps, based on the entries you have saved.</p>
      </section>
      <section className="summary-grid" aria-label="Health summary">
        <article className="summary-card">
          <h2>PCOS assessment</h2>
          {screening ? (
            <>
              <p className={`risk-label risk-label--${screening.risk_level.toLowerCase()}`}>
                {screening.risk_level} screening indicators
              </p>
              <p>BMI: {screening.bmi}</p>
              <p className="muted">Screening only; this is not a medical diagnosis.</p>
            </>
          ) : (
            <p className="muted">No assessment is saved yet.</p>
          )}
          <Link className="text-link" to="/assessment">
            {screening ? "Review assessment" : "Complete assessment"}
          </Link>
        </article>
        <article className="summary-card">
          <h2>Today's tracker</h2>
          {today ? (
            <ul className="compact-list">
              <li>Cramp level: {today.cramp_pain_level}/10</li>
              <li>Water: {today.water_intake_liters} L</li>
              <li>Sleep: {today.sleep_hours} hours</li>
              <li>Mood: {today.mood}</li>
            </ul>
          ) : (
            <p className="muted">No entry has been saved for today.</p>
          )}
          <Link className="text-link" to="/tracker">
            {today ? "Update today's entry" : "Start tracking"}
          </Link>
        </article>
        <article className="summary-card">
          <h2>Recent tracking</h2>
          <p>
            {data.recent_logs.length
              ? `${data.recent_logs.length} recent entries available.`
              : "Your saved tracker entries will appear here."}
          </p>
          <Link className="text-link" to="/reports">View reports</Link>
        </article>
        <article className="summary-card">
          <h2>Doctor directory</h2>
          <p className="muted">Browse doctor profiles registered in GynoCare.</p>
          <Link className="text-link" to="/doctors">Explore doctors</Link>
        </article>
        <article className="summary-card">
          <h2>Yoga &amp; movement</h2>
          <p className="muted">Browse the original gentle yoga poses and guided breathing session.</p>
          <Link className="text-link" to="/movement">Explore tutorials</Link>
        </article>
        <article className="summary-card">
          <h2>Wellness games</h2>
          <p className="muted">Take a short, self-paced mood break with the original games.</p>
          <Link className="text-link" to="/games">Play a game</Link>
        </article>
      </section>
    </>
  );
}

function DoctorDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctor-profile"],
    queryFn: () => apiRequest("/doctors/me"),
  });

  if (isLoading) return <LoadingState label="Loading your clinic profile..." />;
  if (error) return <ErrorState error={error} fallback="Could not load your clinic profile." />;

  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">Doctor portal</span>
        <h1>Welcome, Dr. {user.full_name}</h1>
        <p>Manage the clinic information shown in the public doctor directory.</p>
      </section>
      <article className="summary-card doctor-summary">
        <h2>{data?.clinic_name || "Clinic profile not completed"}</h2>
        {data ? (
          <ul className="compact-list">
            <li>Specialization: {data.specialization}</li>
            <li>Location: {data.city}</li>
            <li>Consultation hours: {data.consultation_hours}</li>
          </ul>
        ) : (
          <p className="muted">No clinic profile is saved yet.</p>
        )}
        <Link className="button button-primary" to="/doctor/profile">
          {data ? "Edit clinic profile" : "Complete clinic profile"}
        </Link>
      </article>
    </>
  );
}

function AdminAIWorkspace() {
  const [question, setQuestion] = useState("How many patients registered this month?");
  const [answer, setAnswer] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function askAssistant() {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/ai/admin/assistant", {
        method: "POST",
        data: { question },
      });
      setAnswer(response.answer || "No answer was returned.");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Could not contact the admin AI assistant.");
    } finally {
      setLoading(false);
    }
  }

  async function generateContent() {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest("/ai/admin/content-generator", {
        method: "POST",
        data: { category: "pcos_education", topic: "Healthy lifestyle habits for PCOS", audience: "patients" },
      });
      setContent(response.draft || "No draft was generated.");
    } catch (requestError) {
      setError(requestError?.response?.data?.detail || "Could not generate AI content.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="summary-card">
      <h2>AI Admin Assistant</h2>
      <label className="form-field">
        Ask the platform assistant
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} />
      </label>
      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button className="button button-primary" type="button" disabled={loading} onClick={askAssistant}>
          {loading ? "Processing..." : "Ask AI"}
        </button>
        <button className="button button-secondary" type="button" onClick={generateContent} disabled={loading}>
          Generate content draft
        </button>
      </div>
      {error && <p className="page-error" role="alert">{error}</p>}
      {answer && (
        <div style={{ marginTop: 12 }}>
          <h3>Assistant response</h3>
          <p>{answer}</p>
        </div>
      )}
      {content && (
        <div style={{ marginTop: 12 }}>
          <h3>AI-generated draft</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{content}</p>
        </div>
      )}
    </section>
  );
}

function AdminDashboard() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiRequest("/admin/dashboard"),
  });

  if (isLoading) return <LoadingState label="Loading admin dashboard..." />;
  if (error) return <ErrorState error={error} fallback="Could not load the admin dashboard." />;

  return (
    <>
      <section className="page-heading">
        <span className="eyebrow">Admin portal</span>
        <h1>Welcome, {user.full_name}</h1>
        <p>Monitor patient growth, doctor approvals, and platform performance.</p>
      </section>
      <section className="summary-grid" aria-label="Admin overview">
        <article className="summary-card"><h2>Total patients</h2><p>{data.total_patients}</p></article>
        <article className="summary-card"><h2>Doctors</h2><p>{data.total_doctors}</p></article>
        <article className="summary-card"><h2>Approved doctors</h2><p>{data.approved_doctors}</p></article>
        <article className="summary-card"><h2>Pending approvals</h2><p>{data.pending_doctor_approvals}</p></article>
        <article className="summary-card"><h2>Rejected</h2><p>{data.rejected_doctors}</p></article>
        <article className="summary-card"><h2>Active doctors</h2><p>{data.active_doctors}</p></article>
      </section>
      <section className="summary-card">
        <h2>Recent patient registrations</h2>
        {data.recent_patient_registrations.length ? (
          <ul className="compact-list">
            {data.recent_patient_registrations.map((patient) => (
              <li key={patient.id}>{patient.full_name} · {patient.email}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No patients have registered yet.</p>
        )}
      </section>
      <AdminAIWorkspace />
    </>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "doctor") return <DoctorDashboard />;
  return <PatientDashboard />;
}
