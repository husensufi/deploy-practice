import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const gameIcons = {
  bubbles: "🫧",
  runner: "🏃‍♀️",
  match: "🃏",
  craving: "🔮",
};

const gameColors = {
  bubbles: "bubbles",
  runner: "runner",
  match: "match",
  craving: "craving",
};

export default function GamesPage() {
  const [friendId, setFriendId] = useState("");
  const [gameId, setGameId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const gamesQuery = useQuery({
    queryKey: ["wellness-games"],
    queryFn: () => apiRequest("/wellness/games"),
  });
  const connectionsQuery = useQuery({
    queryKey: ["connections"],
    queryFn: () => apiRequest("/connections"),
  });
  const inviteMutation = useMutation({
    mutationFn: ({ friend, game }) =>
      apiRequest(`/connections/${friend}/games/invite`, {
        method: "POST",
        data: { game_name: game },
      }),
    onSuccess: () => setInviteMessage("Game invitation sent."),
  });

  if (gamesQuery.isLoading || connectionsQuery.isLoading) {
    return <LoadingState label="Loading wellness games..." />;
  }
  if (gamesQuery.error) {
    return <ErrorState error={gamesQuery.error} fallback="Could not load wellness games." />;
  }
  if (connectionsQuery.error) {
    return <ErrorState error={connectionsQuery.error} fallback="Could not load your support circle." />;
  }

  const games = gamesQuery.data;
  const acceptedConnections = connectionsQuery.data.accepted;
  const selectedGame = games.find((game) => game.id === gameId);

  function invite(event) {
    event.preventDefault();
    setInviteMessage("");
    inviteMutation.mutate(
      { friend: friendId, game: selectedGame.name },
      {
        onError: (error) =>
          setInviteMessage(error.response?.data?.detail || "Could not send the invitation."),
      },
    );
  }

  return (
    <section className="content-page wellness-page">
      <header className="page-heading">
        <span className="eyebrow">Take a mood break</span>
        <h1>Wellness games</h1>
        <p>A few minutes of play can offer a gentle distraction. Choose a game and play at your own pace.</p>
      </header>
      <div className="wellness-card-grid games-grid">
        {games.map((game) => (
          <article className="wellness-card game-card" key={game.id}>
            <div className={`wellness-game-art wellness-game-art--${gameColors[game.id]}`} aria-hidden="true">
              {gameIcons[game.id]}
            </div>
            <div className="wellness-card-body">
              <h2>{game.name}</h2>
              <p>{game.description}</p>
              <Link className="button button-primary" to={`/games/${game.id}`}>Play {game.name}</Link>
            </div>
          </article>
        ))}
      </div>
      <section className="summary-card" aria-labelledby="invite-game-heading">
        <h2 id="invite-game-heading">Invite someone to play</h2>
        {acceptedConnections.length ? (
          <form className="game-invite-fields" onSubmit={invite}>
            <label className="form-field">
              Choose from my circle
              <select value={friendId} onChange={(event) => setFriendId(event.target.value)} required>
                <option value="">Select a person</option>
                {acceptedConnections.map((connection) => (
                  <option value={connection.other_user_id} key={connection.other_user_id}>
                    {connection.other_user_name} ({connection.relationship_type})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Choose a game
              <select value={gameId} onChange={(event) => setGameId(event.target.value)} required>
                <option value="">Select a game</option>
                {games.map((game) => <option value={game.id} key={game.id}>{game.name}</option>)}
              </select>
            </label>
            <button className="button button-primary" type="submit" disabled={!selectedGame || inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending invitation..." : "Send invitation"}
            </button>
            {inviteMessage && (
              <p className={inviteMutation.isError ? "page-error" : "success-message"} role="status">
                {inviteMessage}
              </p>
            )}
          </form>
        ) : (
          <p className="muted">
            Connect with someone and accept their request before sending a game invitation.
          </p>
        )}
      </section>
      <p className="muted">Scores are for the current play session; the legacy application does not save game history or rewards.</p>
    </section>
  );
}
