import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
vi.mock("../../services/api.js", () => ({ apiRequest: apiRequestMock }));

import { AuthProvider } from "../../contexts/AuthContext.jsx";
import ProtectedRoute from "../../components/common/ProtectedRoute.jsx";
import ProfileSettingsPage from "./ProfileSettingsPage.jsx";

const patient = {
  id: 1,
  full_name: "Patient Example",
  email: "patient@example.test",
  mobile: "+10000000000",
  role: "patient",
};

function renderPage(mode) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/profile/${mode}`]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/profile/edit" element={<ProfileSettingsPage mode="edit" />} />
            <Route path="/profile/password" element={<ProfileSettingsPage mode="password" />} />
          </Route>
          <Route path="/login" element={<p>Login page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("Profile settings", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("saves permitted profile fields through the authenticated API", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/auth/me") return Promise.resolve(patient);
      if (path === "/auth/profile") return Promise.resolve({ ...patient, full_name: "Updated Name" });
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage("edit");
    fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Updated Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect((await screen.findByRole("status")).textContent).toContain("profile has been updated");
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/auth/profile", {
        method: "PUT",
        data: { full_name: "Updated Name", mobile: "+10000000000" },
      });
    });
  });

  it("changes password and clears local session after server confirmation", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/auth/me") return Promise.resolve(patient);
      if (path === "/auth/password") return Promise.resolve(undefined);
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderPage("password");
    fireEvent.change(await screen.findByLabelText("Current password"), { target: { value: "InitialPass9" } });
    fireEvent.change(screen.getByLabelText(/New password/), { target: { value: "SecurePass10" } });
    fireEvent.change(screen.getByLabelText(/Confirm new password/), { target: { value: "SecurePass10" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Login page")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/auth/password", {
      method: "POST",
      data: {
        current_password: "InitialPass9",
        new_password: "SecurePass10",
        confirm_new_password: "SecurePass10",
      },
    });
  });
});
