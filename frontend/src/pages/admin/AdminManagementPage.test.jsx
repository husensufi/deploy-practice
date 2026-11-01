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
