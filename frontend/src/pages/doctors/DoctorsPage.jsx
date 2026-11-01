import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

function getLocalDateInputValue() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

export default function DoctorsPage() {
  const queryClient = useQueryClient();
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [appointmentDate, setAppointmentDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [reason, setReason] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => apiRequest("/doctors"),
  });
  const booking = useMutation({
    mutationFn: (values) => apiRequest("/appointments", { method: "POST", data: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      setBookingMessage("Appointment request sent. You can follow its status from Appointments.");
      setSelectedDoctor(null);
      setAppointmentDate("");
      setPreferredTime("");
      setReason("");
    },
  });

  if (isLoading) return <LoadingState label="Loading doctor directory..." />;
  if (error) return <ErrorState error={error} fallback="Could not load doctor directory." />;

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Doctor directory</span>
        <h1>Gynecologists</h1>
        <p>Approved doctors available for appointment requests.</p>
      </div>
      {!data.length ? (
        <p className="empty-state">No doctor profiles have been registered yet.</p>
      ) : (
        <div className="doctor-grid">
          {data.map((doctor) => (
            <article className="summary-card doctor-card" key={doctor.id}>
              <div className="doctor-avatar" aria-hidden="true">
                {doctor.full_name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2>Dr. {doctor.full_name}</h2>
                <p className="eyebrow">{doctor.specialization}</p>
                <p>{doctor.clinic_name}</p>
                <p className="muted">{doctor.address}, {doctor.city}</p>
                <p className="muted">{doctor.consultation_hours}</p>
                {doctor.about && <p>{doctor.about}</p>}
                <a className="text-link" href={`tel:${doctor.phone}`}>{doctor.phone}</a>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    setSelectedDoctor(doctor);
                    setBookingMessage("");
                    booking.reset();
                  }}
                >
                  Request appointment
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {bookingMessage && <p className="success-message" role="status">{bookingMessage}</p>}
      {selectedDoctor && (
        <form
          className="form-card"
          onSubmit={(event) => {
            event.preventDefault();
            booking.mutate({
              doctor_id: selectedDoctor.user_id,
              appointment_date: appointmentDate,
              preferred_time: preferredTime,
              reason,
            });
          }}
        >
          <div className="page-heading">
            <span className="eyebrow">Appointment request</span>
            <h2>Dr. {selectedDoctor.full_name}</h2>
          </div>
          <div className="form-grid">
            <label className="form-field">Date
              <input
                type="date"
                min={getLocalDateInputValue()}
                value={appointmentDate}
                onChange={(event) => setAppointmentDate(event.target.value)}
                required
              />
            </label>
            <label className="form-field">Preferred time
              <input
                type="time"
                value={preferredTime}
                onChange={(event) => setPreferredTime(event.target.value)}
                required
              />
            </label>
            <label className="form-field field-span">Reason for consultation
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={3}
                maxLength={3000}
                rows={4}
                required
              />
            </label>
          </div>
          {booking.isSuccess && <p className="success-message" role="status">Appointment request sent.</p>}
          {booking.error && <p className="page-error" role="alert">{booking.error?.response?.data?.detail || "Could not request the appointment."}</p>}
          <div className="button-row">
            <button className="button button-primary" disabled={booking.isPending}>
              {booking.isPending ? "Sending request..." : "Send request"}
            </button>
            <button className="button button-secondary" type="button" onClick={() => setSelectedDoctor(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
