import { X } from "lucide-react";

export default function AppointmentDetailsDialog({ appointment, viewer, onClose }) {
  if (!appointment) return null;

  return (
    <div className="appointment-dialog-backdrop">
      <section
        className="appointment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-details-title"
      >
        <header className="appointment-dialog-heading">
          <div>
            <p className="eyebrow">Appointment details</p>
            <h2 id="appointment-details-title">
              {viewer === "doctor" ? appointment.patient_name : `Dr. ${appointment.doctor_name}`}
            </h2>
          </div>
          <button className="appointment-icon-button" type="button" aria-label="Close details" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </header>
        <span className={`appointment-status appointment-status--${appointment.status}`}>
          {appointment.status}
        </span>
        <dl className="appointment-detail-list">
          <div><dt>Date</dt><dd>{appointment.appointment_date}</dd></div>
          <div><dt>Time</dt><dd>{appointment.preferred_time}</dd></div>
          {viewer === "doctor" ? (
            <div><dt>Patient email</dt><dd>{appointment.patient_email}</dd></div>
          ) : (
            <>
              <div><dt>Specialization</dt><dd>{appointment.doctor_specialization || "Not specified"}</dd></div>
              <div><dt>Clinic</dt><dd>{appointment.clinic_name || "Not specified"}</dd></div>
              <div><dt>Doctor availability</dt><dd>{appointment.doctor_active ? "Active" : "Inactive — contact Admin for reassignment"}</dd></div>
            </>
          )}
          <div><dt>Reason</dt><dd>{appointment.reason}</dd></div>
          {appointment.doctor_note && <div><dt>Doctor's note</dt><dd>{appointment.doctor_note}</dd></div>}
          {appointment.admin_note && <div><dt>Admin note</dt><dd>{appointment.admin_note}</dd></div>}
          {appointment.reschedule_date && (
            <>
              <div><dt>Proposed date</dt><dd>{appointment.reschedule_date}</dd></div>
              <div><dt>Proposed time</dt><dd>{appointment.reschedule_time}</dd></div>
              <div><dt>Proposal from</dt><dd>{appointment.reschedule_requested_by}</dd></div>
            </>
          )}
        </dl>
        <button className="button button-secondary" type="button" onClick={onClose}>Close</button>
      </section>
    </div>
  );
}
