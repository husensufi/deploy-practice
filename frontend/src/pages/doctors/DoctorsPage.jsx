import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BriefcaseMedical,
  CalendarDays,
  CalendarPlus,
  Clock3,
  HeartPulse,
  MapPin,
  Stethoscope,
} from "lucide-react";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const consultationReasons = [
  "Irregular periods / Menstrual cycle issues",
  "PCOS symptoms and management",
  "Weight management",
  "Acne and skin problems",
  "Excessive hair growth (Hirsutism)",
  "Hair thinning / Hair loss",
  "Fertility and pregnancy planning",
  "Hormonal imbalance",
  "Diet and nutrition guidance",
  "Exercise and lifestyle guidance",
  "Ultrasound and diagnostic guidance",
  "Mental health, stress and anxiety",
  "Follow-up consultation",
  "Other (Please specify)",
];

const appointmentSlots = Array.from({ length: 16 }, (_, index) => {
  const totalMinutes = 10 * 60 + index * 30;
  const hour24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hour12 = hour24 % 12 || 12;
  const period = hour24 < 12 ? "AM" : "PM";
  return {
    value: `${String(hour24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
    label: `${hour12}:${String(minutes).padStart(2, "0")} ${period}`,
  };
});

function getLocalDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function doctorLocation(doctor) {
  const address = [doctor.city, doctor.address]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index);
  return address.length ? address.join(", ") : "Location not listed";
}

function DoctorAvatar({ doctor }) {
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  if (doctor.photo_url && !photoUnavailable) {
    return (
      <img
        className="doctor-avatar doctor-avatar--photo"
        src={doctor.photo_url}
        alt={`Dr. ${doctor.full_name}`}
        onError={() => setPhotoUnavailable(true)}
      />
    );
  }
  return (
    <div className="doctor-avatar" aria-hidden="true">
      {doctor.full_name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function DoctorsPage() {
  const queryClient = useQueryClient();
  const bookingCard = useRef(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [bookingMessage, setBookingMessage] = useState("");
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => apiRequest("/doctors"),
  });
  const booking = useMutation({
    mutationFn: (values) => apiRequest("/appointments", { method: "POST", data: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingMessage("Appointment request sent. You can follow its status from Appointments.");
    },
  });

  useEffect(() => {
    if (selectedDoctor) {
      bookingCard.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  }, [selectedDoctor]);

  if (isLoading) return <LoadingState label="Loading doctor directory..." />;
  if (error) return <ErrorState error={error} fallback="Could not load doctor directory." />;

  function closeBooking() {
    setSelectedDoctor(null);
    setAppointmentDate("");
    setPreferredTime("");
    setReason("");
    setOtherReason("");
    setAdditionalNotes("");
    setValidationErrors({});
    setBookingMessage("");
    setPhotoUnavailable(false);
    booking.reset();
  }

  function submitBooking(event) {
    event.preventDefault();
    const errors = {};
    if (!appointmentDate) errors.appointmentDate = "Select an appointment date.";
    if (!preferredTime) errors.preferredTime = "Select a preferred time.";
    if (!reason) errors.reason = "Select a consultation reason.";
    if (reason === "Other (Please specify)" && otherReason.trim().length < 3) {
      errors.otherReason = "Please specify your reason (at least 3 characters).";
    }
    if (Object.keys(errors).length) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors({});
    setBookingMessage("");
    booking.mutate({
      doctor_id: selectedDoctor.user_id,
      appointment_date: appointmentDate,
      preferred_time: preferredTime,
      reason: reason === "Other (Please specify)"
        ? `Other (Please specify): ${otherReason.trim()}`
        : reason,
      additional_notes: additionalNotes.trim() || null,
    });
  }

  function updateField(field, setter) {
    return (event) => {
      setter(event.target.value);
      setValidationErrors((current) => ({ ...current, [field]: undefined }));
      if (field === "reason" && event.target.value !== "Other (Please specify)") {
        setOtherReason("");
        setValidationErrors((current) => ({ ...current, otherReason: undefined }));
      }
    };
  }

  return (
    <section className="content-page doctor-directory-page">
      {!selectedDoctor && (
        <div className="page-heading" id="doctor-directory">
          <span className="eyebrow">Doctor directory</span>
          <h1>Gynecologists</h1>
          <p>Approved doctors available for appointment requests.</p>
        </div>
      )}
      {!selectedDoctor && (!data.length ? (
        <p className="empty-state">No doctor profiles have been registered yet.</p>
      ) : (
        <div className="doctor-grid">
          {data.map((doctor) => (
            <article className="summary-card doctor-card" key={doctor.id}>
              <DoctorAvatar doctor={doctor} />
              <div>
                <h2>Dr. {doctor.full_name}</h2>
                <p className="eyebrow">
                  {doctor.qualification ? `${doctor.qualification} · ` : ""}
                  {doctor.specialization}
                </p>
                {doctor.medical_reg_no && (
                  <p className="muted" style={{ fontSize: "0.85rem", margin: "2px 0 6px" }}>
                    Reg. No: <strong>{doctor.medical_reg_no}</strong>
                  </p>
                )}
                <p>{doctor.clinic_name}</p>
                <p className="muted">{doctor.address}, {doctor.city}</p>
                <p className="muted">{doctor.consultation_hours}</p>
                {doctor.consultation_fee != null && (
                  <p style={{ fontWeight: 600, color: "#6b244a", margin: "4px 0" }}>
                    Fee: ₹{doctor.consultation_fee}
                  </p>
                )}
                {doctor.about && <p>{doctor.about}</p>}
                <a className="text-link" href={`tel:${doctor.phone}`}>{doctor.phone}</a>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setBookingMessage("");
                    setPhotoUnavailable(false);
                    setValidationErrors({});
                    booking.reset();
                  }}
                >
                  Request appointment
                </button>
              </div>
            </article>
          ))}
        </div>
      ))}

      {selectedDoctor && (
        <section className="booking-shell" ref={bookingCard} aria-labelledby="booking-title">
          <header className="booking-hero">
            <div className="booking-hero-copy">
              <span className="booking-hero-icon"><CalendarDays size={30} aria-hidden="true" /></span>
              <div>
                <h1 id="booking-title">Request Appointment</h1>
                <p>Book a consultation with Dr. {selectedDoctor.full_name}</p>
              </div>
            </div>
            <div className="booking-illustration" aria-hidden="true">
              <span className="booking-illustration-leaf booking-illustration-leaf--left" />
              <span className="booking-illustration-calendar"><CalendarDays size={60} strokeWidth={1.4} /></span>
              <span className="booking-illustration-heart"><HeartPulse size={42} strokeWidth={1.5} /></span>
              <span className="booking-illustration-leaf booking-illustration-leaf--right" />
            </div>
          </header>

          <div className="booking-content">
            <aside className="booking-doctor-panel" aria-label="Doctor information">
              <div className="booking-doctor-identity">
                {selectedDoctor.photo_url && !photoUnavailable ? (
                  <img
                    className="booking-doctor-photo"
                    src={selectedDoctor.photo_url}
                    alt={`Dr. ${selectedDoctor.full_name}`}
                    onError={() => setPhotoUnavailable(true)}
                  />
                ) : (
                  <div className="booking-doctor-photo booking-doctor-photo--fallback" aria-hidden="true">
                    <Stethoscope size={34} />
                  </div>
                )}
                <div>
                  <h2>Dr. {selectedDoctor.full_name}</h2>
                  <span className="booking-specialization">
                    {selectedDoctor.qualification ? `${selectedDoctor.qualification} · ` : ""}
                    {selectedDoctor.specialization}
                  </span>
                  {selectedDoctor.medical_reg_no && (
                    <span className="muted" style={{ display: "block", fontSize: "0.85rem", marginTop: 2 }}>
                      Reg: {selectedDoctor.medical_reg_no}
                    </span>
                  )}
                  {selectedDoctor.consultation_fee != null && (
                    <span style={{ display: "block", fontWeight: 600, color: "#6b244a", fontSize: "0.9rem", marginTop: 2 }}>
                      Fee: ₹{selectedDoctor.consultation_fee}
                    </span>
                  )}
                </div>
              </div>
              <ul className="booking-doctor-facts">
                <li>
                  <BriefcaseMedical size={19} aria-hidden="true" />
                  <span>
                    {selectedDoctor.years_experience == null
                      ? "Experience not listed"
                      : `${selectedDoctor.years_experience}+ Years Experience`}
                  </span>
                </li>
                <li><MapPin size={19} aria-hidden="true" /><span>{doctorLocation(selectedDoctor)}</span></li>
                <li>
                  <Clock3 size={19} aria-hidden="true" />
                  <span>{selectedDoctor.consultation_hours || "Availability not listed"}</span>
                </li>
              </ul>
              {selectedDoctor.clinic_name && <p className="booking-clinic-name">{selectedDoctor.clinic_name}</p>}
            </aside>

            <form className="booking-form" noValidate onSubmit={submitBooking}>
              <div className="booking-form-grid">
                <label className="form-field booking-field">
                  Appointment Date <span className="required-mark">*</span>
                  <span className="booking-input-wrap">
                    <CalendarDays size={19} aria-hidden="true" />
                    <input
                      type="date"
                      min={getLocalDateInputValue()}
                      value={appointmentDate}
                      aria-invalid={Boolean(validationErrors.appointmentDate)}
                      aria-describedby={validationErrors.appointmentDate ? "appointment-date-error" : undefined}
                      onChange={updateField("appointmentDate", setAppointmentDate)}
                    />
                  </span>
                  {validationErrors.appointmentDate && <span className="field-error" id="appointment-date-error" role="alert">{validationErrors.appointmentDate}</span>}
                </label>

                <label className="form-field booking-field">
                  Preferred Time <span className="required-mark">*</span>
                  <span className="booking-input-wrap">
                    <Clock3 size={19} aria-hidden="true" />
                    <select
                      value={preferredTime}
                      aria-invalid={Boolean(validationErrors.preferredTime)}
                      aria-describedby={validationErrors.preferredTime ? "preferred-time-error" : undefined}
                      onChange={updateField("preferredTime", setPreferredTime)}
                    >
                      <option value="">Select time</option>
                      {appointmentSlots.map((slot) => (
                        <option value={slot.value} key={slot.value}>{slot.label}</option>
                      ))}
                    </select>
                  </span>
                  {validationErrors.preferredTime && <span className="field-error" id="preferred-time-error" role="alert">{validationErrors.preferredTime}</span>}
                </label>

                <label className="form-field booking-field booking-field--full">
                  Reason for Consultation <span className="required-mark">*</span>
                  <span className="booking-input-wrap">
                    <Stethoscope size={19} aria-hidden="true" />
                    <select
                      value={reason}
                      aria-invalid={Boolean(validationErrors.reason)}
                      aria-describedby={validationErrors.reason ? "consultation-reason-error" : undefined}
                      onChange={updateField("reason", setReason)}
                    >
                      <option value="">Select a reason</option>
                      {consultationReasons.map((option) => (
                        <option value={option} key={option}>{option}</option>
                      ))}
                    </select>
                  </span>
                  {validationErrors.reason && <span className="field-error" id="consultation-reason-error" role="alert">{validationErrors.reason}</span>}
                </label>

                {reason === "Other (Please specify)" && (
                  <label className="form-field booking-field booking-field--full">
                    Please specify your reason <span className="required-mark">*</span>
                    <input
                      type="text"
                      maxLength={300}
                      value={otherReason}
                      aria-invalid={Boolean(validationErrors.otherReason)}
                      aria-describedby={validationErrors.otherReason ? "other-reason-error" : undefined}
                      onChange={updateField("otherReason", setOtherReason)}
                    />
                    {validationErrors.otherReason && <span className="field-error" id="other-reason-error" role="alert">{validationErrors.otherReason}</span>}
                  </label>
                )}

                <label className="form-field booking-field booking-field--full">
                  Additional Notes for Doctor <span className="booking-optional">(Optional)</span>
                  <textarea
                    rows={4}
                    maxLength={500}
                    placeholder="Describe your symptoms, concerns, or any additional information for the doctor..."
                    value={additionalNotes}
                    onChange={(event) => setAdditionalNotes(event.target.value)}
                  />
                  <span className="booking-character-count" aria-live="polite">
                    {additionalNotes.length} / 500
                  </span>
                </label>
              </div>

              {bookingMessage && <p className="success-message booking-feedback" role="status">{bookingMessage}</p>}
              {booking.error && (
                <p className="page-error booking-feedback" role="alert">
                  {booking.error?.response?.data?.detail || "Could not request the appointment."}
                </p>
              )}
              <div className="booking-actions">
                <button
                  className="button booking-submit"
                  disabled={booking.isPending || booking.isSuccess}
                  type="submit"
                >
                  <CalendarPlus size={19} aria-hidden="true" />
                  {booking.isPending ? "Sending request..." : booking.isSuccess ? "Request Sent" : "Send Appointment Request"}
                </button>
                <button className="button booking-cancel" type="button" onClick={closeBooking}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </section>
      )}
    </section>
  );
}
