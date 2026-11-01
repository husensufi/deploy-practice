import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));

vi.mock("../../services/api.js", () => ({
  apiRequest: apiRequestMock,
}));

import ConnectionsPage from "./ConnectionsPage.jsx";

describe("ConnectionsPage", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
  });

  it("shows the support circle and sends a connection request", async () => {
    apiRequestMock.mockResolvedValue({
      accepted: [{
        id: 4,
        other_user_id: 8,
        other_user_name: "Sam Support",
        relationship_type: "friend",
        status: "accepted",
        direction: "accepted",
      }],
      pending_incoming: [],
      pending_outgoing: [],
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ConnectionsPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Sam Support")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Their registered email"), {
      target: { value: "friend@example.test" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("/connections", {
        method: "POST",
        data: { friend_email: "friend@example.test", relationship_type: "friend" },
      });
    });
  });
});
