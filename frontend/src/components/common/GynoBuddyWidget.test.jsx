import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/api.js", () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from "../../services/api.js";
import GynoBuddyWidget from "./GynoBuddyWidget.jsx";

describe("GynoBuddyWidget", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    apiRequest.mockReset();
  });

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

  it("sends a message when Enter is pressed in the composer", async () => {
    apiRequest.mockResolvedValue({ reply: "I can help with that." });
    render(<GynoBuddyWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Ask GynoBuddy" }));
    const composer = screen.getByLabelText("Your message");
    fireEvent.change(composer, { target: { value: "Tell me about PCOS" } });
    fireEvent.keyDown(composer, { key: "Enter" });

    await waitFor(() => {
      expect(apiRequest).toHaveBeenCalledWith("/chat/reply", {
        method: "POST",
        data: {
          messages: [{ role: "user", content: "Tell me about PCOS" }],
        },
      });
    });
    expect(await screen.findByText("I can help with that.")).toBeTruthy();
  });

  it("keeps Shift+Enter available for a new line", () => {
    apiRequest.mockResolvedValue({ reply: "Received." });
    render(<GynoBuddyWidget />);

    fireEvent.click(screen.getByRole("button", { name: "Ask GynoBuddy" }));
    const composer = screen.getByLabelText("Your message");
    fireEvent.change(composer, { target: { value: "First line" } });
    fireEvent.keyDown(composer, { key: "Enter", shiftKey: true });

    expect(apiRequest).not.toHaveBeenCalled();
    expect(composer.value).toBe("First line");
  });
});
