import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
      throw new Error(`Unexpected API request: ${path}`);
    });

    render(
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
      </AuthProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    expect(await screen.findByText("Login page")).toBeTruthy();
    expect(screen.queryByText("Patient portal")).toBeNull();
    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/auth/logout", {
        method: "POST",
      });
    });
  });
});
