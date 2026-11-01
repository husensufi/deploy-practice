import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarPlus,
  Check,
  CircleAlert,
  Clock3,
  Eye,
  MessageCircle,
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

export default function PatientAppointmentsPage() {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [form, setForm] = useState({ appointment_date: "", preferred_time: "", note: "" });
  const [reassignmentNote, setReassignmentNote] = useState("");
  const [rescheduleResponseNote, setRescheduleResponseNote] = useState("");
  const [success, setSuccess] = useState("");
  const [statusNotice, setStatusNotice] = useState("");
  const previousAppointments = useRef(null);
  const appointments = useQuery({
    queryKey: ["appointments"],
    queryFn: () => apiRequest("/appointments"),
    refetchInterval: 5000,
  });
  const cancel = useMutation({
    mutationFn: (appointmentId) =>
      apiRequest(`/appointments/${appointmentId}/cancel`, { method: "POST" }),
    onSuccess: () => {
      setSuccess("Appointment cancelled.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  const reschedule = useMutation({
    mutationFn: ({ appointmentId, data }) =>
      apiRequest(`/appointments/${appointmentId}/reschedule`, { method: "POST", data }),
    onSuccess: () => {
      setRescheduling(null);
      setForm({ appointment_date: "", preferred_time: "", note: "" });
      setSuccess("Your reschedule request was sent to the doctor.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  const rescheduleDecision = useMutation({
    mutationFn: ({ appointmentId, decision, note }) =>
      apiRequest(`/appointments/${appointmentId}/reschedule-decision`, {
        method: "POST",
        data: { decision, note: note || null },
      }),
    onSuccess: (updated) => {
      setDetails(updated);
        setRescheduleResponseNote("");
        setSuccess("Reschedule response saved.");
        queryClient.invalidateQueries({ queryKey: ["appointments"] });
      },
  });
  const reassignment = useMutation({
    mutationFn: ({ appointmentId, note }) =>
      apiRequest(`/appointments/${appointmentId}/reassignment`, {
        method: "POST",
        data: { note },
      }),
    onSuccess: () => {
      setReassigning(null);
      setReassignmentNote("");
      setSuccess("Reassignment request sent to Admin.");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
  });
  useEffect(() => {
    if (!appointments.data) return;
    if (previousAppointments.current) {
      const changed = appointments.data.find((item) => {
        const previous = previousAppointments.current.get(item.id);
        return previous && (
          previous.status !== item.status
          || previous.doctor_note !== item.doctor_note
          || previous.appointment_date !== item.appointment_date
          || previous.preferred_time !== item.preferred_time
        );
      });
      if (changed) {
        setStatusNotice(`Appointment with Dr. ${changed.doctor_name} was updated: ${changed.status}.`);
      }
    }
    previousAppointments.current = new Map(
      appointments.data.map((item) => [item.id, {
        status: item.status,
        doctor_note: item.doctor_note,
        appointment_date: item.appointment_date,
        preferred_time: item.preferred_time,
      }]),
    );
  }, [appointments.data]);

  if (appointments.isLoading) return <LoadingState label="Loading your appointments..." />;
  if (appointments.error) return <ErrorState error={appointments.error} fallback="Could not load your appointments." />;

  const pendingAction = cancel.isPending || reschedule.isPending || rescheduleDecision.isPending || reassignment.isPending;
  const actionError = cancel.error || reschedule.error || rescheduleDecision.error || reassignment.error;

  function showError(error) {
    return error?.response?.data?.detail || "Could not complete this appointment action.";
  }

  function confirmCancel(appointment) {
    if (window.confirm(`Cancel your appointment with Dr. ${appointment.doctor_name}?`)) {
      setSuccess("");
      cancel.mutate(appointment.id);
    }
  }

  function submitReschedule(event) {
    event.preventDefault();
    if (!rescheduling || !window.confirm("Send this reschedule request to the doctor?")) return;
    setSuccess("");
    reschedule.mutate({
      appointmentId: rescheduling.id,
      data: form,
    });
  }

  function renderRescheduleForm(appointment) {
    return rescheduling?.id === appointment.id ? (
      <form className="appointment-action-form" onSubmit={submitReschedule}>
        <h3>Request a different date and time</h3>
        <div className="appointment-inline-fields">
          <label className="form-field">New date
            <input
              type="date"
              min={localDateValue()}
              required
              value={form.appointment_date}
              onChange={(event) => setForm({ ...form, appointment_date: event.target.value })}
            />
          </label>
          <label className="form-field">New time
            <input
              type="time"
              required
              value={form.preferred_time}
              onChange={(event) => setForm({ ...form, preferred_time: event.target.value })}
            />
          </label>
        </div>
        <label className="form-field">Note for the doctor (optional)
          <textarea
            rows={2}
            maxLength={3000}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
        <div className="appointment-actions">
          <button className="button appointment-button appointment-button--reschedule" disabled={reschedule.isPending}>
            <CalendarPlus size={17} aria-hidden="true" />
            {reschedule.isPending ? "Sending..." : "Send Request"}
          </button>
          <button className="button appointment-button appointment-button--neutral" type="button" onClick={() => setRescheduling(null)}>
            <X size={17} aria-hidden="true" /> Close
          </button>
        </div>
      </form>
    ) : null;
  }

  function renderReassignmentForm(appointment) {
    return reassigning?.id === appointment.id ? (
      <form
        className="appointment-action-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!window.confirm("Send this reassignment request to Admin?")) return;
          reassignment.mutate({ appointmentId: appointment.id, note: reassignmentNote });
        }}
      >
        <label className="form-field">Why do you need reassignment?
          <textarea
            required
            minLength={3}
            maxLength={3000}
            rows={2}
            value={reassignmentNote}
            onChange={(event) => setReassignmentNote(event.target.value)}
          />
        </label>
        <div className="appointment-actions">
          <button className="button appointment-button appointment-button--reassign" disabled={reassignment.isPending}>
            <MessageCircle size={17} aria-hidden="true" />
            {reassignment.isPending ? "Sending..." : "Request Reassignment"}
          </button>
          <button className="button appointment-button appointment-button--neutral" type="button" onClick={() => setReassigning(null)}>
            <X size={17} aria-hidden="true" /> Close
          </button>
        </div>
      </form>
    ) : null;
  }

  return (
    <section className="content-page">
      <div className="appointment-page-heading">
        <div className="page-heading">
          <span className="eyebrow">Patient portal</span>
          <h1>Appointments</h1>
          <p>Review upcoming requests, decisions, and your appointment history.</p>
        </div>
        <Link className="button appointment-button appointment-button--book" to="/doctors">
          <CalendarPlus size={18} aria-hidden="true" /> Book Appointment
        </Link>
      </div>
      {success && <p className="success-message appointment-notice" role="status">{success}</p>}
      {statusNotice && <p className="appointment-notice" role="status">{statusNotice}</p>}
      {actionError && <p className="page-error" role="alert">{showError(actionError)}</p>}
      <section className="summary-grid appointment-stat-grid" aria-label="Your appointment counts">
        {["pending", "accepted", "rescheduled", "completed"].map((status) => (
          <article className="summary-card" key={status}>
            <h2>{status[0].toUpperCase() + status.slice(1)}</h2>
            <p>{appointments.data.filter((item) => item.status === status).length}</p>
          </article>
        ))}
      </section>
      {!appointments.data.length ? (
        <p className="empty-state">No appointments yet. Book an appointment with an approved doctor.</p>
      ) : (
        <div className="appointment-list">
          {appointments.data.map((appointment) => {
            const canCancel = ["pending", "accepted", "rescheduled"].includes(appointment.status);
            const doctorProposal = appointment.status === "rescheduled" && appointment.reschedule_requested_by === "doctor";
            const patientProposal = appointment.status === "rescheduled" && appointment.reschedule_requested_by === "patient";
            return (
              <article className="summary-card appointment-card" key={appointment.id}>
                <div className="appointment-card-heading">
                  <div>
                    <p className="eyebrow">{appointment.appointment_date} · {appointment.preferred_time}</p>
                    <h2>Dr. {appointment.doctor_name}</h2>
                    <p className="muted">{appointment.doctor_specialization || "Doctor"}{appointment.clinic_name ? ` · ${appointment.clinic_name}` : ""}</p>
                  </div>
                  <span className={`appointment-status appointment-status--${appointment.status}`}>{appointment.status}</span>
                </div>
                <p><strong>Reason:</strong> {appointment.reason}</p>
                {appointment.additional_notes && (
                  <p><strong>Additional notes:</strong> {appointment.additional_notes}</p>
                )}
                {appointment.doctor_note && <p><strong>Doctor's note:</strong> {appointment.doctor_note}</p>}
                {appointment.admin_note && <p><strong>Admin note:</strong> {appointment.admin_note}</p>}
                {appointment.reschedule_date && (
                  <p className="appointment-proposal">
                    <Clock3 size={17} aria-hidden="true" />
                    Proposed: {appointment.reschedule_date} at {appointment.reschedule_time} ({appointment.reschedule_requested_by})
                  </p>
                )}
                {appointment.reassignment_requested && <p className="appointment-notice">Reassignment request sent to Admin.</p>}
                <div className="appointment-actions">
                  <button className="button appointment-button appointment-button--details" type="button" onClick={() => setDetails(appointment)}>
                    <Eye size={17} aria-hidden="true" /> View Details
                  </button>
                  {appointment.status === "accepted" && appointment.doctor_active && (
                    <button
                      className="button appointment-button appointment-button--reschedule"
                      type="button"
                      disabled={pendingAction}
                      onClick={() => {
                        setForm({ appointment_date: "", preferred_time: "", note: "" });
                        setRescheduling(appointment);
                      }}
                    >
                      <RefreshCw size={17} aria-hidden="true" /> Reschedule Request
                    </button>
                  )}
                  {appointment.status === "rejected" && (
                    <Link className="button appointment-button appointment-button--book" to="/doctors">
                      <CalendarPlus size={17} aria-hidden="true" /> Book Another Appointment
                    </Link>
                  )}
                  {!appointment.doctor_active && canCancel && (
                    <button
                      className="button appointment-button appointment-button--reassign"
                      type="button"
                      disabled={pendingAction || appointment.reassignment_requested}
                      onClick={() => setReassigning(appointment)}
                    >
                      <CircleAlert size={17} aria-hidden="true" />
                      {appointment.reassignment_requested ? "Reassignment Requested" : "Contact Admin / Request Reassignment"}
                    </button>
                  )}
                  {canCancel && (
                    <button
                      className="button appointment-button appointment-button--cancel"
                      type="button"
                      disabled={pendingAction}
                      onClick={() => confirmCancel(appointment)}
                    >
                      <X size={17} aria-hidden="true" />
                      {cancel.isPending && cancel.variables === appointment.id ? "Cancelling..." : "Cancel Appointment"}
                    </button>
                  )}
                  {doctorProposal && (
                    <>
                      <button
                        className="button appointment-button appointment-button--accept"
                        type="button"
                        disabled={pendingAction}
                        onClick={() => {
                          if (window.confirm(`Accept the proposed appointment time ${appointment.reschedule_date} at ${appointment.reschedule_time}?`)) {
                            rescheduleDecision.mutate({
                              appointmentId: appointment.id,
                              decision: "accepted",
                              note: rescheduleResponseNote,
                            });
                          }
                        }}
                      >
                        <Check size={17} aria-hidden="true" /> Accept Proposed Time
                      </button>
                      <button
                        className="button appointment-button appointment-button--cancel"
                        type="button"
                        disabled={pendingAction || rescheduleResponseNote.trim().length < 3}
                        onClick={() => {
                          if (window.confirm("Decline the doctor's proposed time?")) {
                            rescheduleDecision.mutate({
                              appointmentId: appointment.id,
                              decision: "rejected",
                              note: rescheduleResponseNote,
                            });
                          }
                        }}
                      >
                        <X size={17} aria-hidden="true" /> Decline Proposal
                      </button>
                    </>
                  )}
                  {patientProposal && <span className="muted">Waiting for the doctor to review your reschedule request.</span>}
                </div>
                {doctorProposal && (
                  <label className="form-field appointment-note-field">
                    Note to the doctor (required to decline, optional to accept)
                    <textarea
                      rows={2}
                      maxLength={3000}
                      value={rescheduleResponseNote}
                      onChange={(event) => setRescheduleResponseNote(event.target.value)}
                    />
                  </label>
                )}
                {renderRescheduleForm(appointment)}
                {renderReassignmentForm(appointment)}
              </article>
            );
          })}
        </div>
      )}
      <AppointmentDetailsDialog appointment={details} viewer="patient" onClose={() => setDetails(null)} />
    </section>
  );
}
