import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }));
const { userMock } = vi.hoisted(() => ({
  userMock: { full_name: "Test Patient", role: "patient" },
}));

vi.mock("../../services/api.js", () => ({
  apiRequest: apiRequestMock,
}));

vi.mock("../../contexts/AuthContext.jsx", () => ({
  useAuth: () => ({ user: userMock }),
}));

import HomePage from "../HomePage.jsx";
import GamePlayPage from "./GamePlayPage.jsx";
import GamesPage from "./GamesPage.jsx";
import MovementPage from "./MovementPage.jsx";
import MovementTutorialPage from "./MovementTutorialPage.jsx";

const tutorials = {
  disclaimer: "Yoga does not cure PCOS.",
  tutorials: [
    {
      id: "butterfly",
      category: "Yoga",
      name: "Butterfly Pose",
      description: "Sit and join your feet.",
      difficulty: "Gentle",
      duration_seconds: 30,
      instructions: ["Sit comfortably.", "Join your feet."],
      video_search_url: "https://www.youtube.com/results?search_query=butterfly",
    },
    {
      id: "breathing",
      category: "Breathing",
      name: "Alternate Nostril Breathing",
      description: "Breathe slowly.",
      difficulty: "Gentle",
      duration_seconds: 30,
      instructions: ["Sit comfortably.", "Breathe slowly."],
      video_search_url: "https://www.youtube.com/results?search_query=breathing",
    },
  ],
};

const games = [
  { id: "bubbles", name: "Zen Bubbles", description: "Pop floating bubbles." },
  { id: "runner", name: "Aura Runner", description: "Dodge clouds and collect hearts." },
  { id: "match", name: "Mind Match", description: "Find the self-care pairs." },
  { id: "craving", name: "Guess My Craving", description: "Answer playful questions." },
];

function renderWithRoutes(path, routes) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>{routes}</Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("movement tutorials", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
    userMock.role = "patient";
    userMock.full_name = "Test Patient";
  });

  it("loads the legacy pose catalog and opens step-by-step details", async () => {
    apiRequestMock.mockImplementation((path) =>
      path === "/wellness/tutorials" ? Promise.resolve(tutorials) : Promise.resolve(tutorials.tutorials[0]),
    );
    renderWithRoutes("/movement", [
      <Route path="/movement" element={<MovementPage />} key="list" />,
      <Route path="/movement/:tutorialId" element={<MovementTutorialPage />} key="detail" />,
    ]);

    expect(await screen.findByRole("heading", { name: "Butterfly Pose" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("link", { name: "View instructions" })[0]);

    expect(await screen.findByText("Step-by-step instructions")).toBeTruthy();
    expect(screen.getByText("Join your feet.")).toBeTruthy();
    expect(apiRequestMock).toHaveBeenCalledWith("/wellness/tutorials/butterfly");
  });

  it("starts and can stop the original timed guided session", async () => {
    apiRequestMock.mockResolvedValue(tutorials);
    renderWithRoutes("/movement", [
      <Route path="/movement" element={<MovementPage />} key="list" />,
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Start guided session" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Butterfly Pose" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stop session" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a clear error if the tutorial service is unavailable", async () => {
    apiRequestMock.mockRejectedValue(new Error("Service unavailable"));
    renderWithRoutes("/movement", [
      <Route path="/movement" element={<MovementPage />} key="list" />,
    ]);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Could not load movement tutorials.",
    );
  });
});

describe("wellness games", () => {
  afterEach(() => {
    cleanup();
    apiRequestMock.mockReset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("lists games and sends an invitation to an accepted connection", async () => {
    apiRequestMock.mockImplementation((path) => {
      if (path === "/wellness/games") return Promise.resolve(games);
      if (path === "/connections") {
        return Promise.resolve({
          accepted: [{
            id: 2,
            other_user_id: 17,
            other_user_name: "Sam",
            relationship_type: "friend",
            status: "accepted",
            direction: "accepted",
          }],
          pending_incoming: [],
          pending_outgoing: [],
        });
      }
      if (path === "/connections/17/games/invite") return Promise.resolve({ message_id: 8, friend_id: 17 });
      throw new Error(`Unexpected API request: ${path}`);
    });
    renderWithRoutes("/games", [<Route path="/games" element={<GamesPage />} key="games" />]);

    expect(await screen.findByRole("link", { name: "Play Zen Bubbles" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Choose from my circle"), { target: { value: "17" } });
    fireEvent.change(screen.getByLabelText("Choose a game"), { target: { value: "match" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invitation" }));

    expect((await screen.findByRole("status")).textContent).toContain("Game invitation sent.");
    expect(apiRequestMock).toHaveBeenCalledWith("/connections/17/games/invite", {
      method: "POST",
      data: { game_name: "Mind Match" },
    });
  });

  it("pops Zen Bubbles and updates the current-round score", async () => {
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/bubbles", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    expect(await screen.findByText("Popped: 0")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Pop bubble 1" }));
    expect(screen.getByText("Popped: 1")).toBeTruthy();
  });

  it("starts Aura Runner and supports lane controls", async () => {
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/runner", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Start run" }));
    expect(screen.getByText("Lane 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Move left" }));
    expect(screen.getByText("Lane 1")).toBeTruthy();
  });

  it("scores a heart collected by the runner", async () => {
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/runner", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    const startButton = await screen.findByRole("button", { name: "Start run" });
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.useFakeTimers();
    fireEvent.click(startButton);
    fireEvent.click(screen.getByRole("button", { name: "Move left" }));

    for (let tick = 0; tick < 5; tick += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(650);
      });
    }

    expect(screen.getByText(
      (_, element) => element.classList.contains("game-score") && element.textContent === "Score: 5",
    )).toBeTruthy();
  });

  it("matches a pair and counts the move", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/match", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Reveal card 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Reveal card 9" }));
    expect(await screen.findByText("Moves: 1")).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Card 1: 💧" }).classList.contains("match-card--matched"),
      ).toBe(true);
    });

  });

  it("turns mismatched Mind Match cards back over", async () => {
    let randomValue = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      randomValue += 0.01;
      return randomValue;
    });
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/match", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    const firstCard = await screen.findByRole("button", { name: "Reveal card 1" });
    fireEvent.click(firstCard);
    const firstLabel = screen.getByRole("button", { name: /^Card 1:/ }).getAttribute("aria-label");
    vi.useFakeTimers();
    const otherCard = screen.getByRole("button", { name: "Reveal card 2" });
    fireEvent.click(otherCard);
    expect(screen.getByText("Moves: 1")).toBeTruthy();
    const secondLabel = screen.getByRole("button", { name: /^Card 2:/ }).getAttribute("aria-label");
    expect(secondLabel).not.toBe(firstLabel);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
    });

    expect(screen.getByRole("button", { name: "Reveal card 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reveal card 2" })).toBeTruthy();
  });

  it("follows the craving decision tree and can restart it", async () => {
    apiRequestMock.mockResolvedValue(games);
    renderWithRoutes("/games/craving", [
      <Route path="/games/:gameId" element={<GamePlayPage />} key="game" />,
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Sweet 🍯" }));
    fireEvent.click(screen.getByRole("button", { name: "Warm" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes please" }));
    expect(screen.getByRole("heading", { name: "A square of dark chocolate" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Play again" }));
    expect(screen.getByRole("heading", { name: "Sweet or savory right now?" })).toBeTruthy();
  });

  it("connects the patient dashboard to movement and games", async () => {
    apiRequestMock.mockResolvedValue({
      screening_result: null,
      today_log: null,
      recent_logs: [],
    });
    renderWithRoutes("/home", [
      <Route path="/home" element={<HomePage />} key="home" />,
    ]);

    expect(
      (await screen.findByRole("link", { name: "Explore tutorials" })).getAttribute("href"),
    ).toBe("/movement");
    expect(screen.getByRole("link", { name: "Play a game" }).getAttribute("href")).toBe(
      "/games",
    );
  });

  it("renders the patient AI workspace and triggers a real health insights call", async () => {
    userMock.role = "patient";
    userMock.full_name = "Test Patient";
    apiRequestMock.mockImplementation((path, config) => {
      if (path === "/patients/dashboard") {
        return Promise.resolve({
          screening_result: null,
          today_log: null,
          recent_logs: [],
        });
      }
      if (path === "/ai/patient/health-insights") {
        return Promise.resolve({ summary: "Your health trends look stable." });
      }
      return Promise.resolve({});
    });

    renderWithRoutes("/home", [
      <Route path="/home" element={<HomePage />} key="home" />,
    ]);

    expect(await screen.findByRole("heading", { name: "AI Health Assistant" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Health insights" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/ai/patient/health-insights",
        expect.objectContaining({
          method: "POST",
          data: { prompt: "Summarize my recent health trends and next steps." },
        }),
      );
    });
    expect(await screen.findByText("Your health trends look stable.")).toBeTruthy();
  });

  it("renders the admin AI workspace and triggers the admin assistant call", async () => {
    userMock.role = "admin";
    userMock.full_name = "Test Admin";
    apiRequestMock.mockImplementation((path, config) => {
      if (path === "/admin/dashboard") {
        return Promise.resolve({
          total_patients: 12,
          total_doctors: 5,
          approved_doctors: 4,
          pending_doctor_approvals: 1,
          rejected_doctors: 0,
          active_doctors: 4,
          recent_patient_registrations: [],
        });
      }
      if (path === "/ai/admin/assistant") {
        return Promise.resolve({ answer: "Platform activity is stable." });
      }
      return Promise.resolve({});
    });

    renderWithRoutes("/home", [
      <Route path="/home" element={<HomePage />} key="home" />,
    ]);

    expect(await screen.findByRole("heading", { name: "AI Admin Assistant" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith(
        "/ai/admin/assistant",
        expect.objectContaining({
          method: "POST",
          data: { question: "How many patients registered this month?" },
        }),
      );
    });
    expect(await screen.findByText("Platform activity is stable.")).toBeTruthy();
  });
});
