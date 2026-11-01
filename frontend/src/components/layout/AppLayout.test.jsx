import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../services/api.js", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("../common/GynoBuddyWidget.jsx", () => ({
  default: () => null,
}));

import { AuthProvider } from "../../contexts/AuthContext.jsx";
import AppLayout from "./AppLayout.jsx";
import ProtectedRoute from "../common/ProtectedRoute.jsx";

describe("AppLayout logout", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("clears authenticated state and redirects after a successful logout", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/auth/me") {
        return Promise.resolve({
          id: 1,
          full_name: "Test Patient",
          email: "patient@example.test",
          role: "patient",
        });
      }
      if (path === "/auth/logout") return Promise.resolve(undefined);
      if (path === "/auth/notifications") return Promise.resolve([]);
      throw new Error(`Unexpected API request: ${path}`);
    });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/home"]}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/home" element={<p>Patient portal</p>} />
                </Route>
              </Route>
              <Route path="/login" element={<p>Login page</p>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByLabelText("Open profile menu"));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(await screen.findByText("Login page")).toBeTruthy();
    expect(screen.queryByText("Patient portal")).toBeNull();
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
      });
    });
  });

  it("navigates Admin menu items to their distinct working sections", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/auth/me") {
        return Promise.resolve({
          id: 2,
          full_name: "Test Admin",
          email: "admin@example.test",
          role: "admin",
        });
      }
      if (path === "/auth/notifications") return Promise.resolve([]);
      throw new Error(`Unexpected API request: ${path}`);
    });

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <AuthProvider>
          <MemoryRouter initialEntries={["/admin"]}>
            <Routes>
              <Route element={<ProtectedRoute roles={["admin"]} />}>
                <Route element={<AppLayout />}>
                  <Route path="/admin" element={<p>Admin dashboard section</p>} />
                  <Route path="/admin/patients" element={<p>Patient management section</p>} />
                  <Route path="/admin/doctors" element={<p>Doctor management section</p>} />
                  <Route path="/admin/approvals" element={<p>Doctor approvals section</p>} />
                  <Route path="/admin/reports" element={<p>Platform reports section</p>} />
                  <Route path="/admin/appointments" element={<p>Appointment monitoring section</p>} />
                </Route>
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Admin dashboard section")).toBeTruthy();
    for (const [label, expectedSection] of [
      ["Patients", "Patient management section"],
      ["Doctors", "Doctor management section"],
      ["Approvals", "Doctor approvals section"],
      ["Reports", "Platform reports section"],
      ["Appointments", "Appointment monitoring section"],
      ["Dashboard", "Admin dashboard section"],
    ]) {
      fireEvent.click(screen.getByRole("link", { name: label }));
      expect(await screen.findByText(expectedSection)).toBeTruthy();
    }
  });
});
