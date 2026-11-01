import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/api.js", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../../services/api.js";
import GynoBuddyWidget from "./GynoBuddyWidget.jsx";

describe("GynoBuddyWidget", () => {
  it("sends a message to the backend and displays its reply", async () => {
    apiRequest.mockResolvedValue({ reply: "PCOS varies by person." });
    render(<GynoBuddyWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Ask GynoBuddy" }));
    fireEvent.change(screen.getByLabelText("Your message"), {
      target: { value: "What is PCOS?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/chat/reply", {
        method: "POST",
        data: {
          messages: [{ role: "user", content: "What is PCOS?" }],
        },
      });
    });
    expect(await screen.findByText("PCOS varies by person.")).toBeTruthy();
  });
});
