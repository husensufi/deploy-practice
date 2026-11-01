import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  Eye,
  RefreshCw,
  X,
} from "lucide-react";

import AppointmentDetailsDialog from "../../components/appointments/AppointmentDetailsDialog.jsx";
import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

function localDateValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function DoctorAppointmentsPage() {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState({});
  const [completionNotes, setCompletionNotes] = useState({});
  const [details, setDetails] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [proposal, setProposal] = useState({ appointment_date: "", preferred_time: "", note: "" });
  const [success, setSuccess] = useState("");
  const appointments = useQuery({
    queryKey: ["doctor-appointments"],
    queryFn: () => apiRequest("/doctor/appointments"),
    refetchInterval: 5000,
  });
  const decision = useMutation({
    mutationFn: ({ appointmentId, value }) =>
      apiRequest(`/doctor/appointments/${appointmentId}/decision`, {
        method: "POST",
        data: value,
      }),
    onSuccess: (updated) => {
      setSuccess(`Appointment ${updated.status}. Patient has been notified.`);
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const complete = useMutation({
    mutationFn: ({ appointmentId, note }) =>
      apiRequest(`/doctor/appointments/${appointmentId}/complete`, {
        method: "POST",
        data: { note: note || null },
      }),
    onSuccess: () => {
      setSuccess("Appointment marked completed.");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const reschedule = useMutation({
    mutationFn: ({ appointmentId, data }) =>
      apiRequest(`/doctor/appointments/${appointmentId}/reschedule`, {
        method: "POST",
        data,
      }),
    onSuccess: () => {
      setRescheduling(null);
      setProposal({ appointment_date: "", preferred_time: "", note: "" });
      setSuccess("Reschedule proposal sent to the patient.");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const rescheduleDecision = useMutation({
    mutationFn: ({ appointmentId, value }) =>
      apiRequest(`/doctor/appointments/${appointmentId}/reschedule-decision`, {
        method: "POST",
        data: value,
      }),
    onSuccess: (updated) => {
      setSuccess(updated.status === "accepted" ? "Reschedule request confirmed." : "Reschedule request declined.");
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  if (appointments.isLoading) return <LoadingState label="Loading appointment requests..." />;
  if (appointments.error) return <ErrorState error={appointments.error} fallback="Could not load appointment requests." />;

  const busy = decision.isPending || complete.isPending || reschedule.isPending || rescheduleDecision.isPending;
  const actionError = decision.error || complete.error || reschedule.error || rescheduleDecision.error;

  function getError(error) {
    return error?.response?.data?.detail || "Could not update the appointment.";
  }

  function decide(appointment, nextStatus) {
    const note = (notes[appointment.id] || "").trim();
    if (nextStatus === "rejected" && note.length < 3) {
      setSuccess("");
      decision.reset();
      return;
    }
    const action = nextStatus === "accepted" ? "Accept this appointment request?" : "Reject this request and send the note to the patient?";
    if (!window.confirm(action)) return;
    setSuccess("");
    decision.mutate({
      appointmentId: appointment.id,
      value: { decision: nextStatus, note: note || null },
    });
  }

  function submitProposal(event, appointment) {
    event.preventDefault();
    if (!window.confirm(`Propose ${proposal.appointment_date} at ${proposal.preferred_time} to the patient?`)) return;
    setSuccess("");
    reschedule.mutate({
      appointmentId: appointment.id,
      data: proposal,
    });
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Doctor portal</span>
        <h1>Appointments</h1>
        <p>Review and manage requests assigned to your clinic. Patient details are limited to this appointment.</p>
      </div>
      {success && <p className="success-message appointment-notice" role="status">{success}</p>}
      {actionError && <p className="page-error" role="alert">{getError(actionError)}</p>}
      <section className="summary-grid appointment-stat-grid" aria-label="Appointment request counts">
        {["pending", "accepted", "rescheduled", "completed"].map((status) => (
          <article className="summary-card" key={status}>
            <h2>{status[0].toUpperCase() + status.slice(1)}</h2>
            <p>{appointments.data.filter((item) => item.status === status).length}</p>
          </article>
        ))}
      </section>
      {!appointments.data.length ? (
        <p className="empty-state">No appointment requests have been received.</p>
      ) : (
        <div className="appointment-list">
          {appointments.data.map((appointment) => {
            const patientReschedule = appointment.status === "rescheduled" && appointment.reschedule_requested_by === "patient";
            return (
              <article className="summary-card appointment-card" key={appointment.id}>
                <div className="appointment-card-heading">
                  <div>
                    <p className="eyebrow">{appointment.appointment_date} · {appointment.preferred_time}</p>
                    <h2>{appointment.patient_name}</h2>
                    <a className="text-link" href={`mailto:${appointment.patient_email}`}>{appointment.patient_email}</a>
                  </div>
                  <span className={`appointment-status appointment-status--${appointment.status}`}>{appointment.status}</span>
                </div>
                <p><strong>Reason:</strong> {appointment.reason}</p>
                {appointment.additional_notes && (
                  <p><strong>Patient notes:</strong> {appointment.additional_notes}</p>
                )}
                {appointment.doctor_note && <p><strong>Your note:</strong> {appointment.doctor_note}</p>}
                {appointment.admin_note && <p><strong>Admin note:</strong> {appointment.admin_note}</p>}
                {appointment.reschedule_date && (
                  <p className="appointment-proposal">
                    <CalendarPlus size={17} aria-hidden="true" />
                    Proposed time: {appointment.reschedule_date} at {appointment.reschedule_time} ({appointment.reschedule_requested_by})
                  </p>
                )}
                <div className="appointment-actions">
                  <button className="button appointment-button appointment-button--details" type="button" onClick={() => setDetails(appointment)}>
                    <Eye size={17} aria-hidden="true" /> View Patient
                  </button>
                  {appointment.status === "pending" && (
                    <>
                      <button
                        className="button appointment-button appointment-button--accept"
                        type="button"
                        disabled={busy}
                        onClick={() => decide(appointment, "accepted")}
                      >
                        <Check size={17} aria-hidden="true" /> Accept
                      </button>
                      <button
                        className="button appointment-button appointment-button--reject"
                        type="button"
                        disabled={busy || (notes[appointment.id] || "").trim().length < 3}
                        onClick={() => decide(appointment, "rejected")}
                      >
                        <X size={17} aria-hidden="true" /> Reject
                      </button>
                    </>
                  )}
                  {appointment.status === "accepted" && (
                    <>
                      <button
                        className="button appointment-button appointment-button--reschedule"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setProposal({ appointment_date: "", preferred_time: "", note: "" });
                          setRescheduling(appointment);
                        }}
                      >
                        <RefreshCw size={17} aria-hidden="true" /> Reschedule
                      </button>
                      <button
                        className="button appointment-button appointment-button--complete"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Mark this appointment as completed?")) {
                            setSuccess("");
                            complete.mutate({
                              appointmentId: appointment.id,
                              note: completionNotes[appointment.id],
                            });
                          }
                        }}
                      >
                        <Check size={17} aria-hidden="true" /> Mark Completed
                      </button>
                    </>
                  )}
                  {patientReschedule && (
                    <>
                      <button
                        className="button appointment-button appointment-button--accept"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm(`Accept the patient's requested time ${appointment.reschedule_date} at ${appointment.reschedule_time}?`)) {
                            rescheduleDecision.mutate({
                              appointmentId: appointment.id,
                              value: { decision: "accepted" },
                            });
                          }
                        }}
                      >
                        <Check size={17} aria-hidden="true" /> Accept New Time
                      </button>
                      <button
                        className="button appointment-button appointment-button--reject"
                        type="button"
                        disabled={busy || (notes[appointment.id] || "").trim().length < 3}
                        onClick={() => {
                          if (window.confirm("Decline the reschedule request and send your reason to the patient?")) {
                            rescheduleDecision.mutate({
                              appointmentId: appointment.id,
                              value: { decision: "rejected", note: notes[appointment.id] },
                            });
                          }
                        }}
                      >
                        <X size={17} aria-hidden="true" /> Decline New Time
                      </button>
                    </>
                  )}
                </div>
                {(appointment.status === "pending" || patientReschedule) && (
                  <label className="form-field appointment-note-field">
                    {patientReschedule ? "Note for declining the reschedule (required only to decline)" : "Note for the patient (required to reject, optional to accept)"}
                    <textarea
                      rows={2}
                      maxLength={3000}
                      value={notes[appointment.id] || ""}
                      onChange={(event) => setNotes({ ...notes, [appointment.id]: event.target.value })}
                    />
                    {appointment.status === "pending" && (notes[appointment.id] || "").trim().length < 3 && (
                      <span className="muted">Enter at least 3 characters to enable Reject.</span>
                    )}
                  </label>
                )}
                {appointment.status === "accepted" && (
                  <label className="form-field appointment-note-field">
                    Note for the patient when completing (optional)
                    <textarea
                      rows={2}
                      maxLength={3000}
                      value={completionNotes[appointment.id] || ""}
                      onChange={(event) => setCompletionNotes({
                        ...completionNotes,
                        [appointment.id]: event.target.value,
                      })}
                    />
                  </label>
                )}
                {rescheduling?.id === appointment.id && (
                  <form className="appointment-action-form" onSubmit={(event) => submitProposal(event, appointment)}>
                    <h3>Propose a new appointment time</h3>
                    <div className="appointment-inline-fields">
                      <label className="form-field">Proposed date
                        <input
                          type="date"
                          min={localDateValue()}
                          required
                          value={proposal.appointment_date}
                          onChange={(event) => setProposal({ ...proposal, appointment_date: event.target.value })}
                        />
                      </label>
                      <label className="form-field">Proposed time
                        <input
                          type="time"
                          required
                          value={proposal.preferred_time}
                          onChange={(event) => setProposal({ ...proposal, preferred_time: event.target.value })}
                        />
                      </label>
                    </div>
                    <label className="form-field">Note for the patient (optional)
                      <textarea
                        rows={2}
                        maxLength={3000}
                        value={proposal.note}
                        onChange={(event) => setProposal({ ...proposal, note: event.target.value })}
                      />
                    </label>
                    <div className="appointment-actions">
                      <button className="button appointment-button appointment-button--reschedule" disabled={reschedule.isPending}>
                        <RefreshCw size={17} aria-hidden="true" />
                        {reschedule.isPending ? "Sending..." : "Send Reschedule"}
                      </button>
                      <button className="button appointment-button appointment-button--neutral" type="button" onClick={() => setRescheduling(null)}>
                        <X size={17} aria-hidden="true" /> Close
                      </button>
                    </div>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
      <AppointmentDetailsDialog appointment={details} viewer="doctor" onClose={() => setDetails(null)} />
    </section>
  );
}
