import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { loginMock } = vi.hoisted(() => ({ loginMock: vi.fn() }));

vi.mock("./contexts/AuthContext.jsx", () => ({
  useAuth: () => ({
    login: loginMock,
    user: null,
    status: "unauthenticated",
  }),
}));

import LoginPage from "./pages/auth/LoginPage.jsx";

describe("LoginPage", () => {
  afterEach(() => {
    cleanup();
    loginMock.mockReset();
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
});
