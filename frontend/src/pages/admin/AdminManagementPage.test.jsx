import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { apiRequestMock, apiClientGetMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  apiClientGetMock: vi.fn(),
}));

vi.mock("../../services/api.js", () => ({
  apiRequest: apiRequestMock,
  apiClient: { get: apiClientGetMock },
}));

import AdminManagementPage from "./AdminManagementPage.jsx";

function renderPage(section) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminManagementPage section={section} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Admin management sections", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
    apiClientGetMock.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads real patient records for the Patients section", async () => {
    apiRequestMock.mockResolvedValue([
      {
        id: 7,
        full_name: "Patient Example",
        email: "patient@example.test",
        is_active: true,
        created_at: "2026-10-30T12:00:00",
      },
    ]);

    renderPage("patients");

    expect(await screen.findByRole("heading", { name: "Patients" })).toBeTruthy();
    expect(await screen.findByText("Patient Example")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/patients?limit=all");
  });

  it("loads doctors and saves an approval decision through the Admin API", async () => {
    const doctor = {
      id: 8,
      full_name: "Doctor Example",
      email: "doctor@example.test",
      is_active: false,
      approval_status: "pending",
      created_at: "2026-10-30T12:00:00",
    };
    apiRequestMock.mockImplementation((path, options) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([doctor]);
      if (path === "/admin/doctors/approval-summary") {
        return Promise.resolve({ pending: 1, approved: 0, rejected: 0 });
      }
      if (path.endsWith("/decision")) return Promise.resolve({ ...doctor, ...options.data });
      throw new Error(`Unexpected API request: ${path}`);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage("approvals");
    fireEvent.change(await screen.findByLabelText("Decision note for Doctor Example"), {
      target: { value: "Credentials verified." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/doctors/8/decision", {
        method: "POST",
        data: { decision: "approved", notes: "Credentials verified." },
      });
    });
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("deactivates an active doctor through the Admin status endpoint", async () => {
    const doctor = {
      id: 8,
      full_name: "Doctor Example",
      email: "doctor@example.test",
      role: "doctor",
      is_active: true,
      is_removed: false,
      approval_status: "approved",
    };
    apiRequestMock.mockImplementation((path) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([doctor]);
      if (path === "/admin/doctors/8/status") return Promise.resolve({ ...doctor, is_active: false });
      throw new Error(`Unexpected API request: ${path}`);
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPage("doctors");
    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/doctors/8/status", {
        method: "POST",
        data: { status: "inactive" },
      });
    });
  });

  it("displays the prominent + Register New Doctor button and registers a doctor", async () => {
    apiRequestMock.mockImplementation((path, options) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([]);
      if (path === "/admin/doctors" && options?.method === "POST") {
        return Promise.resolve({
          id: 12,
          full_name: "Dr. Maya Sharma",
          email: "maya.sharma@example.com",
          role: "doctor",
          is_active: true,
          approval_status: "approved",
          specialization: "Gynecologist",
          medical_reg_no: "KMC-48201",
        });
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    renderPage("doctors");

    const registerBtn = await screen.findByRole("button", { name: /\+ Register New Doctor/i });
    expect(registerBtn).toBeTruthy();

    fireEvent.click(registerBtn);
    expect(await screen.findByRole("heading", { name: "Register New Doctor" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Dr. Jane Doe"), {
      target: { value: "Maya Sharma" },
    });
    fireEvent.change(screen.getByPlaceholderText("doctor@example.com"), {
      target: { value: "maya.sharma@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("+91 9876543210"), {
      target: { value: "+91 9888877777" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. MCI-2015-84920"), {
      target: { value: "KMC-48201" },
    });
    fireEvent.change(screen.getByPlaceholderText("MBBS, MD, MS, DGO, etc."), {
      target: { value: "MBBS, MD (OBG)" },
    });
    fireEvent.change(screen.getByPlaceholderText("Gynecologist, Endocrinologist, etc."), {
      target: { value: "Gynecologist" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. Apollo Cradle / Lotus Women Care"), {
      target: { value: "Care Hospital" },
    });
    fireEvent.change(screen.getByPlaceholderText("e.g. #42 5th Cross, Indiranagar"), {
      target: { value: "12th Main Road, Indiranagar" },
    });
    fireEvent.change(screen.getByPlaceholderText("Minimum 8 characters"), {
      target: { value: "DoctorTemp123" },
    });
    fireEvent.change(screen.getByLabelText("Approval Status"), {
      target: { value: "approved" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Register Doctor" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/doctors", expect.objectContaining({
        method: "POST",
        data: expect.objectContaining({
          full_name: "Maya Sharma",
          email: "maya.sharma@example.com",
          mobile: "+91 9888877777",
          medical_reg_no: "KMC-48201",
          qualification: "MBBS, MD (OBG)",
          specialization: "Gynecologist",
          clinic_name: "Care Hospital",
          address: "12th Main Road, Indiranagar",
          approval_status: "approved",
          is_active: true,
        }),
      }));
    });

    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("edits an existing doctor profile via Edit modal", async () => {
    const doctor = {
      id: 9,
      full_name: "Anita Rao",
      email: "anita@example.test",
      role: "doctor",
      mobile: "+91 9123456789",
      specialization: "Gynecologist",
      medical_reg_no: "KMC-11223",
      qualification: "MBBS, MS",
      clinic_name: "City Care",
      address: "MG Road",
      city: "Bangalore",
      is_active: true,
      approval_status: "approved",
      is_removed: false,
    };
    apiRequestMock.mockImplementation((path, options) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([doctor]);
      if (path === "/admin/doctors/9" && options?.method === "PUT") {
        return Promise.resolve({ ...doctor, ...options.data });
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    renderPage("doctors");

    fireEvent.click(await screen.findByRole("button", { name: /Edit/i }));
    expect(await screen.findByRole("heading", { name: "Edit Doctor Details" })).toBeTruthy();

    const clinicInput = screen.getByDisplayValue("City Care");
    fireEvent.change(clinicInput, { target: { value: "Apollo Women Wellness" } });

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/doctors/9", expect.objectContaining({
        method: "PUT",
        data: expect.objectContaining({
          clinic_name: "Apollo Women Wellness",
        }),
      }));
    });
  });

  it("resets doctor password and sends account invitation", async () => {
    const doctor = {
      id: 10,
      full_name: "Rohit Verma",
      email: "rohit@example.test",
      role: "doctor",
      is_active: true,
      approval_status: "approved",
      is_removed: false,
    };
    apiRequestMock.mockImplementation((path, options) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([doctor]);
      if (path === "/admin/doctors/10/reset-password" && options?.method === "POST") {
        return Promise.resolve({
          status: "success",
          message: "Doctor credentials updated and account invitation instructions recorded.",
        });
      }
      throw new Error(`Unexpected API request: ${path}`);
    });

    renderPage("doctors");

    fireEvent.click(await screen.findByRole("button", { name: /Reset \/ Invite/i }));
    expect(await screen.findByRole("heading", { name: "Reset Password / Send Invitation" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Minimum 8 characters"), {
      target: { value: "NewDoctorPass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Send" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/admin/doctors/10/reset-password", expect.objectContaining({
        method: "POST",
        data: expect.objectContaining({
          new_password: "NewDoctorPass123",
          send_invitation: true,
        }),
      }));
    });
  });

  it("requests the approval PDF with the selected status and record limit", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([]);
      if (path === "/admin/doctors/approval-summary") {
        return Promise.resolve({ pending: 0, approved: 2, rejected: 0 });
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    apiClientGetMock.mockResolvedValue({ data: new Blob(["pdf"], { type: "application/pdf" }) });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });
    renderPage("approvals");
    fireEvent.click(await screen.findByRole("button", { name: "Approved 2" }));
    fireEvent.click(await screen.findByRole("button", { name: "Download filtered PDF" }));

    await waitFor(() => {
      expect(apiClientGetMock).toHaveBeenCalledWith(
        "/admin/doctors/approval-report.pdf?approval_status=approved&limit=10&include_removed=false",
        { responseType: "blob" },
      );
    });
  });

  it.each(["50", "100", "all"])("applies the %s approval record-count selector to server queries", async (limit) => {
    apiRequestMock.mockImplementation((path) => {
      if (path.startsWith("/admin/doctors?")) return Promise.resolve([]);
      if (path === "/admin/doctors/approval-summary") {
        return Promise.resolve({ pending: 0, approved: 0, rejected: 0 });
      }
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage("approvals");
    const selector = await screen.findByLabelText("Records");
    fireEvent.change(selector, { target: { value: limit } });
    await waitFor(() => {
      expect(apiRequestMock.mock.calls).toContainEqual([
        `/admin/doctors?approval_status=pending&limit=${limit}&include_removed=false`,
      ]);
    });
  });

  it("builds reports from actual Admin dashboard metrics and activity", async () => {
    apiRequestMock.mockResolvedValue({
      total_patients: 18,
      total_doctors: 4,
      approved_doctors: 3,
      pending_doctor_approvals: 1,
      total_appointments: 12,
      pending_appointments: 2,
      accepted_appointments: 4,
      completed_appointments: 3,
      cancelled_appointments: 1,
      recent_appointment_activity: [{
        id: 17,
        patient_id: 7,
        patient_name: "Patient Example",
        doctor_id: 8,
        doctor_name: "Doctor Example",
        appointment_date: "2026-11-12",
        preferred_time: "10:00",
        status: "accepted",
      }],
      recent_patient_registrations: [],
    });

    renderPage("reports");

    expect(await screen.findByRole("heading", { name: "Platform reports" })).toBeTruthy();
    expect(await screen.findByText("18")).toBeTruthy();
    expect(await screen.findByText("Patient Example")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/admin/dashboard");
  });
});
