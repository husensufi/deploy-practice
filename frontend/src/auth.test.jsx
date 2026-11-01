import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { loginMock, registerMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn(),
}));

vi.mock("./contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    login: loginMock,
    register: registerMock,
    user: null,
    status: "unauthenticated",
  }),
}));

import LoginPage from "./pages/auth/LoginPage.jsx";
import SignupPage from "./pages/auth/SignupPage.jsx";

describe("Authentication forms", () => {
  afterEach(() => {
    cleanup();
    loginMock.mockReset();
    registerMock.mockReset();
  });

  it("validates the email before sending a login request", async () => {
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<p>Home portal</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "not-an-email" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("submits valid credentials and navigates to the portal", async () => {
    loginMock.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<p>Home portal</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "patient@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith({
        email: "patient@example.test",
        password: "test-password",
      });
    });
    expect(await screen.findByText("Home portal")).toBeTruthy();
  });

  it("validates password confirmation and submits a patient registration", async () => {
    registerMock.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/home" element={<p>Home portal</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Test Patient" },
    });
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "patient@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Mobile number"), {
      target: { value: "+10000000000" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    fireEvent.change(screen.getByLabelText(/Confirm password/), {
      target: { value: "different-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Passwords do not match.")).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Confirm password/), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        role: "patient",
        full_name: "Test Patient",
        email: "patient@example.test",
        mobile: "+10000000000",
        password: "test-password",
        confirm_password: "test-password",
      });
    });
    expect(await screen.findByText("Home portal")).toBeTruthy();
  });
});
