import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const relationships = ["partner", "husband", "boyfriend", "brother", "sister", "friend"];

function ApiError({ error }) {
  if (!error) return null;
  return <p className="page-error" role="alert">{error.response?.data?.detail || "The request could not be completed."}</p>;
}

export default function ConnectionsPage() {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [relationshipType, setRelationshipType] = useState("friend");
  const connectionsQuery = useQuery({
    queryKey: ["connections"],
    queryFn: () => apiRequest("/connections"),
  });

  const refreshConnections = () =>
    queryClient.invalidateQueries({ queryKey: ["connections"] });
  const addMutation = useMutation({
    mutationFn: (body) => apiRequest("/connections", { method: "POST", data: body }),
    onSuccess: () => {
      setFriendEmail("");
      setFormError(null);
      return refreshConnections();
    },
  });
  const acceptMutation = useMutation({
    mutationFn: (connectionId) =>
      apiRequest(`/connections/${connectionId}/accept`, { method: "POST" }),
    onSuccess: refreshConnections,
  });
  const careMutation = useMutation({
    mutationFn: (friendId) =>
      apiRequest(`/connections/${friendId}/care-alert`, { method: "POST" }),
    onSuccess: (_data, friendId) =>
      queryClient.invalidateQueries({ queryKey: ["social-chat", friendId] }),
  });

  if (connectionsQuery.isLoading) {
    return <LoadingState label="Loading your connections..." />;
  }
  if (connectionsQuery.error) {
    return <ErrorState error={connectionsQuery.error} fallback="Could not load your connections." />;
  }

  const { accepted, pending_incoming: incoming, pending_outgoing: outgoing } =
    connectionsQuery.data;

  function submitConnection(event) {
    event.preventDefault();
    setFormError(null);
    addMutation.mutate(
      { friend_email: friendEmail, relationship_type: relationshipType },
      { onError: setFormError },
    );
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Support network</span>
        <h1>Friends &amp; family</h1>
        <p>Connect with the people who support you, chat privately, or let them know when you need care.</p>
      </div>

      <form className="form-card" onSubmit={submitConnection}>
        <h2>Connect with someone</h2>
        <ApiError error={formError} />
        <div className="connection-form-fields">
          <label className="form-field">
            Their registered email
            <input
              type="email"
              autoComplete="email"
              required
              value={friendEmail}
              onChange={(event) => setFriendEmail(event.target.value)}
              placeholder="name@example.com"
            />
          </label>
          <label className="form-field">
            Relationship
            <select
              value={relationshipType}
              onChange={(event) => setRelationshipType(event.target.value)}
            >
              {relationships.map((relationship) => (
                <option key={relationship} value={relationship}>
                  {relationship[0].toUpperCase() + relationship.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button button-primary" type="submit" disabled={addMutation.isPending}>
          {addMutation.isPending ? "Sending request..." : "Send request"}
        </button>
      </form>

      <ApiError error={acceptMutation.error || careMutation.error} />

      <section className="connections-section" aria-labelledby="incoming-heading">
        <h2 id="incoming-heading">Pending requests</h2>
        {incoming.length ? (
          <div className="connection-list">
            {incoming.map((connection) => (
              <article className="connection-card" key={connection.id}>
                <div className="doctor-avatar" aria-hidden="true">
                  {connection.other_user_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="connection-card__details">
                  <strong>{connection.other_user_name}</strong>
                  <p className="muted">{connection.relationship_type}</p>
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={acceptMutation.isPending}
                  onClick={() => acceptMutation.mutate(connection.id)}
                >
                  Accept
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">There are no pending requests.</p>
        )}
        {outgoing.length > 0 && (
          <p className="muted">
            Waiting for {outgoing.map((connection) => connection.other_user_name).join(", ")} to accept your request.
          </p>
        )}
      </section>

      <section className="connections-section" aria-labelledby="circle-heading">
        <h2 id="circle-heading">My circle</h2>
        {accepted.length ? (
          <div className="connection-list">
            {accepted.map((connection) => (
              <article className="connection-card" key={connection.id}>
                <div className="doctor-avatar" aria-hidden="true">
                  {connection.other_user_name.slice(0, 1).toUpperCase()}
                </div>
                <div className="connection-card__details">
                  <strong>{connection.other_user_name}</strong>
                  <p className="muted">{connection.relationship_type}</p>
                </div>
                <Link
                  className="button button-primary"
                  to={`/connections/${connection.other_user_id}/chat`}
                >
                  Chat
                </Link>
                <button
                  className="button button-care"
                  type="button"
                  disabled={careMutation.isPending}
                  onClick={() => careMutation.mutate(connection.other_user_id)}
                >
                  I need care
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No connections yet. Add someone using their registered email.</p>
        )}
      </section>
    </section>
  );
}
