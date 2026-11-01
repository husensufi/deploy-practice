import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const statisticLabels = [
  ["total_appointments", "Total"],
  ["pending_appointments", "Pending"],
  ["accepted_appointments", "Accepted"],
  ["rejected_appointments", "Rejected"],
  ["cancelled_appointments", "Cancelled"],
  ["completed_appointments", "Completed"],
  ["rescheduled_appointments", "Rescheduled"],
];

export default function AdminAppointmentsPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => ({
    doctor_id: searchParams.get("doctor_id") || "",
    patient_id: searchParams.get("patient_id") || "",
    status: searchParams.get("status") || "",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
  }));
  const [notes, setNotes] = useState({});
  const [reassignmentDoctors, setReassignmentDoctors] = useState({});
  const [success, setSuccess] = useState("");
  const doctors = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: () => apiRequest("/admin/doctors"),
  });
  const patients = useQuery({
    queryKey: ["admin-patients"],
    queryFn: () => apiRequest("/admin/patients"),
  });
  const dashboard = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiRequest("/admin/dashboard"),
    refetchInterval: 10000,
  });
  const appointments = useQuery({
    queryKey: ["admin-appointments", filters],
    queryFn: () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== ""),
      );
      return apiRequest("/admin/appointments", { params });
    },
    refetchInterval: 10000,
  });
  const cancel = useMutation({
    mutationFn: ({ appointmentId, note }) =>
      apiRequest(`/admin/appointments/${appointmentId}/cancel`, {
        method: "POST",
        data: { note },
      }),
    onSuccess: () => {
      setSuccess("Appointment cancelled and patient notified.");
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const reassign = useMutation({
    mutationFn: ({ appointmentId, doctorId, note }) =>
      apiRequest(`/admin/appointments/${appointmentId}/reassign`, {
        method: "POST",
        data: { doctor_id: doctorId, note },
      }),
    onSuccess: () => {
      setSuccess("Appointment reassigned and sent to the new doctor's pending requests.");
      queryClient.invalidateQueries({ queryKey: ["admin-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  if (doctors.isLoading || patients.isLoading || dashboard.isLoading || appointments.isLoading) {
    return <LoadingState label="Loading appointment management..." />;
  }
  const loadError = doctors.error || patients.error || dashboard.error || appointments.error;
  if (loadError) return <ErrorState error={loadError} fallback="Could not load appointment management." />;
  const activeDoctors = doctors.data.filter(
    (doctor) => doctor.is_active && doctor.approval_status === "approved",
  );
  const actionError = cancel.error || reassign.error;

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Admin portal</span>
        <h1>Appointment management</h1>
        <p>Monitor bookings across the platform and filter by patient, doctor, date, or status.</p>
      </div>
      <section className="summary-grid appointment-stat-grid" aria-label="Appointment statistics">
        {statisticLabels.map(([key, label]) => (
          <article className="summary-card" key={key}>
            <h2>{label}</h2>
            <p>{dashboard.data[key]}</p>
          </article>
        ))}
      </section>
      <section className="form-card">
        <h2>Filters</h2>
        <div className="form-grid">
          <label className="form-field">Doctor
            <select value={filters.doctor_id} onChange={(event) => setFilters({ ...filters, doctor_id: event.target.value })}>
              <option value="">All doctors</option>
              {doctors.data.map((doctor) => <option value={doctor.id} key={doctor.id}>{doctor.full_name}</option>)}
            </select>
          </label>
          <label className="form-field">Patient
            <select value={filters.patient_id} onChange={(event) => setFilters({ ...filters, patient_id: event.target.value })}>
              <option value="">All patients</option>
              {patients.data.map((patient) => <option value={patient.id} key={patient.id}>{patient.full_name}</option>)}
            </select>
          </label>
          <label className="form-field">Status
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">All statuses</option>
              {["pending", "accepted", "rejected", "cancelled", "completed", "rescheduled"].map((status) => (
                <option value={status} key={status}>{status}</option>
              ))}
            </select>
          </label>
          <label className="form-field">From
            <input type="date" value={filters.date_from} onChange={(event) => setFilters({ ...filters, date_from: event.target.value })} />
          </label>
          <label className="form-field">To
            <input type="date" value={filters.date_to} onChange={(event) => setFilters({ ...filters, date_to: event.target.value })} />
          </label>
        </div>
      </section>
      {success && <p className="success-message appointment-notice" role="status">{success}</p>}
      {actionError && <p className="page-error" role="alert">{actionError?.response?.data?.detail || "Could not update this appointment."}</p>}
      {!appointments.data.length ? (
        <p className="empty-state">No appointments match these filters.</p>
      ) : (
        <div className="appointment-list">
          {appointments.data.map((appointment) => (
            <article className="summary-card appointment-card" key={appointment.id}>
              <div className="appointment-card-heading">
                <div>
                  <p className="eyebrow">{appointment.appointment_date} · {appointment.preferred_time}</p>
                  <h2>{appointment.patient_name} with Dr. {appointment.doctor_name}</h2>
                  <p className="muted">{appointment.patient_email}</p>
                </div>
                <span className={`appointment-status appointment-status--${appointment.status}`}>{appointment.status}</span>
              </div>
              <p><strong>Reason:</strong> {appointment.reason}</p>
              {appointment.doctor_note && <p><strong>Doctor's note:</strong> {appointment.doctor_note}</p>}
              {appointment.admin_note && <p><strong>Admin note:</strong> {appointment.admin_note}</p>}
              {appointment.reschedule_date && <p className="appointment-proposal">Proposed time: {appointment.reschedule_date} at {appointment.reschedule_time} ({appointment.reschedule_requested_by})</p>}
              {appointment.reassignment_requested && <p className="appointment-notice">Patient requested reassignment.</p>}
              {["pending", "accepted", "rescheduled"].includes(appointment.status) && (
                <div className="appointment-admin-cancel">
                  <label className="form-field">Admin cancellation reason
                    <input
                      value={notes[appointment.id] || ""}
                      minLength={3}
                      maxLength={3000}
                      onChange={(event) => setNotes({ ...notes, [appointment.id]: event.target.value })}
                    />
                  </label>
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={cancel.isPending || (notes[appointment.id] || "").trim().length < 3}
                    onClick={() => {
                      if (window.confirm("Cancel this appointment and notify the patient?")) {
                        setSuccess("");
                        cancel.mutate({ appointmentId: appointment.id, note: notes[appointment.id] });
                      }
                    }}
                  >
                    Cancel booking
                  </button>
                </div>
              )}
              {appointment.doctor_active === false && ["pending", "accepted", "rescheduled"].includes(appointment.status) && (
                <div className="appointment-admin-cancel">
                  <label className="form-field">Reassign to active approved doctor
                    <select
                      value={reassignmentDoctors[appointment.id] || ""}
                      onChange={(event) => setReassignmentDoctors({
                        ...reassignmentDoctors,
                        [appointment.id]: event.target.value,
                      })}
                    >
                      <option value="">Select doctor</option>
                      {activeDoctors.filter((doctor) => doctor.id !== appointment.doctor_id).map((doctor) => (
                        <option value={doctor.id} key={doctor.id}>{doctor.full_name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">Reassignment note
                    <input
                      value={notes[`reassign-${appointment.id}`] || ""}
                      minLength={3}
                      maxLength={3000}
                      onChange={(event) => setNotes({
                        ...notes,
                        [`reassign-${appointment.id}`]: event.target.value,
                      })}
                    />
                  </label>
                  <button
                    className="button appointment-button appointment-button--reassign"
                    type="button"
                    disabled={
                      reassign.isPending
                      || !reassignmentDoctors[appointment.id]
                      || (notes[`reassign-${appointment.id}`] || "").trim().length < 3
                    }
                    onClick={() => {
                      if (window.confirm("Reassign this appointment to the selected doctor?")) {
                        setSuccess("");
                        reassign.mutate({
                          appointmentId: appointment.id,
                          doctorId: Number(reassignmentDoctors[appointment.id]),
                          note: notes[`reassign-${appointment.id}`],
                        });
                      }
                    }}
                  >
                    Reassign Appointment
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
