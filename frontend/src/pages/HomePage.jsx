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

export default function HomePage() {
  const { user } = useAuth();
  return user.role === "doctor" ? <DoctorDashboard /> : <PatientDashboard />;
}
