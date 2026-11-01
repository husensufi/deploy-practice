import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../services/api.js", () => ({
  apiRequest: apiRequestMock,
}));

import AdminAppointmentsPage from "./AdminAppointmentsPage.jsx";
import DoctorAppointmentsPage from "./DoctorAppointmentsPage.jsx";
import PatientAppointmentsPage from "./PatientAppointmentsPage.jsx";
import DoctorsPage from "../doctors/DoctorsPage.jsx";

const doctor = {
  id: 8,
  user_id: 21,
  full_name: "Asha Doctor",
  specialization: "Gynecologist",
  clinic_name: "Care Clinic",
  city: "Test City",
  address: "1 Test Road",
  phone: "+10000000000",
  consultation_hours: "Weekdays",
  about: "PCOS care",
};

let appointment;

function renderPage(page) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{page}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function apiAppointment() {
  return {
    ...appointment,
    status: appointment.status,
    doctor_note: appointment.doctor_note,
    admin_note: appointment.admin_note,
  };
}

describe("appointment workflow pages", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    appointment = {
      id: 35,
      patient_id: 5,
      patient_name: "Mira Patient",
      patient_email: "mira@example.test",
      doctor_id: 21,
      doctor_name: "Asha Doctor",
      doctor_specialization: "Gynecologist",
      clinic_name: "Care Clinic",
      doctor_active: true,
      appointment_date: "2027-01-12",
      preferred_time: "10:30",
      reason: "Discuss cycle changes",
      status: "pending",
      doctor_note: null,
      admin_note: null,
      reschedule_date: null,
      reschedule_time: null,
      reschedule_requested_by: null,
      reassignment_requested: false,
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("submits a patient booking to the selected approved doctor", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/doctors") return Promise.resolve([doctor]);
      if (path === "/appointments") return Promise.resolve(apiAppointment());
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<DoctorsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Request appointment" }));
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2027-01-12" } });
    fireEvent.change(screen.getByLabelText("Preferred time"), { target: { value: "10:30" } });
    fireEvent.change(screen.getByLabelText("Reason for consultation"), {
      target: { value: "Discuss cycle changes" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/appointments", {
        method: "POST",
        data: {
          doctor_id: 21,
          appointment_date: "2027-01-12",
          preferred_time: "10:30",
          reason: "Discuss cycle changes",
        },
      });
    });
    expect((await screen.findByRole("status")).textContent).toContain("Appointment request sent.");
  });

  it("shows doctor's notes and lets a patient cancel a pending request", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/cancel")) {
        appointment.status = "cancelled";
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    expect(await screen.findByText("Discuss cycle changes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel Appointment" }));
    expect(await screen.findByText("cancelled")).toBeTruthy();
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/appointments/35/cancel", { method: "POST" });
    });
  });

  it("lets a doctor accept with a note and complete an appointment", async () => {
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/doctor/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/decision")) {
        appointment.status = options.data.decision;
        appointment.doctor_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      if (path.endsWith("/complete")) {
        appointment.status = "completed";
        appointment.doctor_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<DoctorAppointmentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "View Patient" }));
    expect(within(screen.getByRole("dialog")).getByText("mira@example.test")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.change(await screen.findByLabelText(/Note for the patient/), {
      target: { value: "Bring your records." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect((await screen.findAllByText("accepted", { selector: ".appointment-status" })).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Bring your records\./)).toBeTruthy();

    fireEvent.change(await screen.findByLabelText("Note for the patient when completing (optional)"), {
      target: { value: "Follow-up in six weeks." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark Completed" }));
    expect(await screen.findByText("completed")).toBeTruthy();
    expect(await screen.findByText(/Follow-up in six weeks\./)).toBeTruthy();
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/doctor/appointments/35/complete", {
        method: "POST",
        data: { note: "Follow-up in six weeks." },
      });
    });
  });

  it("lets a doctor reject a request with a note", async () => {
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/doctor/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/decision")) {
        appointment.status = options.data.decision;
        appointment.doctor_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<DoctorAppointmentsPage />);

    fireEvent.change(await screen.findByLabelText(/Note for the patient/), {
      target: { value: "Please choose another clinic time." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(await screen.findByText("rejected")).toBeTruthy();
    expect(await screen.findByText(/Please choose another clinic time\./)).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/doctor/appointments/35/decision", {
      method: "POST",
      data: { decision: "rejected", note: "Please choose another clinic time." },
    });
  });

  it("submits a patient reschedule request for an accepted appointment", async () => {
    appointment.status = "accepted";
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reschedule")) {
        appointment.status = "rescheduled";
        appointment.reschedule_date = options.data.appointment_date;
        appointment.reschedule_time = options.data.preferred_time;
        appointment.reschedule_requested_by = "patient";
        appointment.doctor_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Reschedule Request" }));
    fireEvent.change(screen.getByLabelText("New date"), { target: { value: "2027-01-19" } });
    fireEvent.change(screen.getByLabelText("New time"), { target: { value: "14:00" } });
    fireEvent.change(screen.getByLabelText("Note for the doctor (optional)"), {
      target: { value: "Morning is no longer convenient." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Request" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/appointments/35/reschedule", {
        method: "POST",
        data: {
          appointment_date: "2027-01-19",
          preferred_time: "14:00",
          note: "Morning is no longer convenient.",
        },
      });
    });
    expect(await screen.findByText("Your reschedule request was sent to the doctor.")).toBeTruthy();
  });

  it("shows detail view and doctor-inactive reassignment action", async () => {
    appointment.doctor_active = false;
    appointment.status = "accepted";
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reassignment")) {
        appointment.reassignment_requested = true;
        appointment.admin_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "View Details" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText(/Inactive — contact Admin for reassignment/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close details" }));
    fireEvent.click(screen.getByRole("button", { name: "Contact Admin / Request Reassignment" }));
    fireEvent.change(screen.getByLabelText("Why do you need reassignment?"), {
      target: { value: "The doctor is no longer available." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request Reassignment" }));
    expect((await screen.findByRole("status")).textContent).toBe("Reassignment request sent to Admin.");
    expect(apiRequestMock).toHaveBeenCalledWith("/appointments/35/reassignment", {
      method: "POST",
      data: { note: "The doctor is no longer available." },
    });
  });

  it("filters and monitors appointments in the admin module", async () => {
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/admin/doctors") return Promise.resolve([{ id: 21, full_name: "Asha Doctor" }]);
      if (path === "/admin/patients") return Promise.resolve([{ id: 5, full_name: "Mira Patient" }]);
      if (path === "/admin/dashboard") {
        return Promise.resolve({
          total_appointments: 1,
          pending_appointments: 1,
          accepted_appointments: 0,
          rejected_appointments: 0,
          cancelled_appointments: 0,
          completed_appointments: 0,
          rescheduled_appointments: 0,
        });
      }
      if (path === "/admin/appointments" && options?.params?.status === "pending") {
        return Promise.resolve([apiAppointment()]);
      }
      if (path === "/admin/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/cancel")) {
        appointment.status = "cancelled";
        appointment.admin_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<AdminAppointmentsPage />);

    expect(await screen.findByText("Mira Patient with Dr. Asha Doctor")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/appointments", {
        params: { status: "pending" },
      });
    });
    fireEvent.change(await screen.findByLabelText("Admin cancellation reason"), {
      target: { value: "Duplicate booking flagged." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(await screen.findByText("cancelled")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/appointments/35/cancel", {
      method: "POST",
      data: { note: "Duplicate booking flagged." },
    });
  });

  it("lets a doctor propose a new time for an accepted appointment", async () => {
    appointment.status = "accepted";
    appointment.doctor_active = true;
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/doctor/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reschedule")) {
        appointment.status = "rescheduled";
        appointment.reschedule_date = options.data.appointment_date;
        appointment.reschedule_time = options.data.preferred_time;
        appointment.reschedule_requested_by = "doctor";
        appointment.doctor_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<DoctorAppointmentsPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Reschedule" }));
    fireEvent.change(screen.getByLabelText("Proposed date"), { target: { value: "2027-01-20" } });
    fireEvent.change(screen.getByLabelText("Proposed time"), { target: { value: "15:30" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Reschedule" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/doctor/appointments/35/reschedule", {
        method: "POST",
        data: { appointment_date: "2027-01-20", preferred_time: "15:30", note: "" },
      });
    });
    expect(await screen.findByText("Reschedule proposal sent to the patient.")).toBeTruthy();
  });

  it("allows patients to respond to a doctor-proposed reschedule", async () => {
    appointment.status = "rescheduled";
    appointment.reschedule_date = "2027-01-20";
    appointment.reschedule_time = "15:30";
    appointment.reschedule_requested_by = "doctor";
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reschedule-decision")) {
        if (options.data.decision === "accepted") {
          appointment.status = "accepted";
          appointment.appointment_date = appointment.reschedule_date;
          appointment.preferred_time = appointment.reschedule_time;
        }
        appointment.reschedule_date = null;
        appointment.reschedule_time = null;
        appointment.reschedule_requested_by = null;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    expect(await screen.findByText(/Proposed: 2027-01-20 at 15:30/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Accept Proposed Time" }));
    expect((await screen.findAllByText("accepted", { selector: ".appointment-status" })).length).toBeGreaterThan(0);
    expect(apiRequestMock).toHaveBeenCalledWith("/appointments/35/reschedule-decision", {
      method: "POST",
      data: { decision: "accepted", note: null },
    });
  });

  it("requires and sends a note when a patient declines a doctor-proposed reschedule", async () => {
    appointment.status = "rescheduled";
    appointment.reschedule_date = "2027-01-20";
    appointment.reschedule_time = "15:30";
    appointment.reschedule_requested_by = "doctor";
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reschedule-decision")) {
        appointment.status = "accepted";
        appointment.doctor_note = options.data.note;
        appointment.reschedule_date = null;
        appointment.reschedule_time = null;
        appointment.reschedule_requested_by = null;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    const decline = await screen.findByRole("button", { name: "Decline Proposal" });
    expect(decline.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Note to the doctor (required to decline, optional to accept)"), {
      target: { value: "That time does not work for me." },
    });
    fireEvent.click(decline);

    expect((await screen.findAllByText("accepted", { selector: ".appointment-status" })).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/That time does not work for me\./)).length).toBeGreaterThan(0);
    expect(apiRequestMock).toHaveBeenCalledWith("/appointments/35/reschedule-decision", {
      method: "POST",
      data: { decision: "rejected", note: "That time does not work for me." },
    });
  });

  it("offers only details and a new booking for rejected appointments", async () => {
    appointment.status = "rejected";
    apiRequestMock.mockImplementation((path) => {
      if (path === "/appointments") return Promise.resolve([apiAppointment()]);
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<PatientAppointmentsPage />);

    expect(await screen.findByRole("button", { name: "View Details" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Book Another Appointment" }).getAttribute("href")).toBe("/doctors");
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel Appointment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reschedule Request" })).toBeNull();
  });

  it("lets Admin reassign a booking after a patient requests it", async () => {
    appointment.doctor_active = false;
    appointment.reassignment_requested = true;
    apiRequestMock.mockImplementation((path, options) => {
      if (path === "/admin/doctors") {
        return Promise.resolve([
          { id: 21, full_name: "Asha Doctor", is_active: false, approval_status: "approved" },
          { id: 22, full_name: "Replacement Doctor", is_active: true, approval_status: "approved" },
        ]);
      }
      if (path === "/admin/patients") return Promise.resolve([{ id: 5, full_name: "Mira Patient" }]);
      if (path === "/admin/dashboard") {
        return Promise.resolve({
          total_appointments: 1,
          pending_appointments: 0,
          accepted_appointments: 1,
          rejected_appointments: 0,
          cancelled_appointments: 0,
          completed_appointments: 0,
          rescheduled_appointments: 0,
        });
      }
      if (path === "/admin/appointments") return Promise.resolve([apiAppointment()]);
      if (path.endsWith("/reassign")) {
        appointment.doctor_id = options.data.doctor_id;
        appointment.doctor_name = "Replacement Doctor";
        appointment.status = "pending";
        appointment.doctor_active = true;
        appointment.reassignment_requested = false;
        appointment.admin_note = options.data.note;
        return Promise.resolve(apiAppointment());
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage(<AdminAppointmentsPage />);

    fireEvent.change(await screen.findByLabelText("Reassign to active approved doctor"), {
      target: { value: "22" },
    });
    fireEvent.change(screen.getByLabelText("Reassignment note"), {
      target: { value: "The original doctor is inactive." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reassign Appointment" }));

    expect(await screen.findByText("Appointment reassigned and sent to the new doctor's pending requests.")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/appointments/35/reassign", {
      method: "POST",
      data: { doctor_id: 22, note: "The original doctor is inactive." },
    });
  });
});
