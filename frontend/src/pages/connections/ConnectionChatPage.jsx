import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiClient, apiRequest } from "../../services/api.js";

const games = ["Zen Bubbles", "Aura Runner", "Mind Match", "Guess My Craving"];

function createWebSocketUrl(friendId) {
  const url = new URL(apiClient.defaults.baseURL);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/chat/${friendId}`;
  return url.toString();
}

export default function ConnectionChatPage() {
  const { friendId } = useParams();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [gameName, setGameName] = useState(games[0]);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [socketError, setSocketError] = useState("");
  const [sendError, setSendError] = useState("");
  const socketRef = useRef(null);
  const retryTimerRef = useRef(null);
  const retriesRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const queryKey = ["social-chat", Number(friendId)];

  const chatQuery = useQuery({
    queryKey,
    queryFn: () => apiRequest(`/connections/${friendId}/chat`),
  });
  const inviteMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/connections/${friendId}/games/invite`, {
        method: "POST",
        data: { game_name: gameName },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  useEffect(() => {
    if (chatQuery.data) setMessages(chatQuery.data.messages);
  }, [chatQuery.data]);

  const connect = useCallback(() => {
    if (!shouldReconnectRef.current) return;
    setSocketStatus(retriesRef.current ? "reconnecting" : "connecting");
    const socket = new WebSocket(createWebSocketUrl(friendId));
    socketRef.current = socket;

    socket.onopen = () => {
      retriesRef.current = 0;
      setSocketStatus("connected");
      setSocketError("");
    };
    socket.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch {
        setSocketError("Received an unreadable chat message.");
        return;
      }
      if (payload.error) {
        setSocketError(payload.error);
        return;
      }
      setMessages((current) =>
        current.some((message) => message.id === payload.id)
          ? current
          : [...current, payload],
      );
    };
    socket.onerror = () => setSocketError("Chat connection encountered an error.");
    socket.onclose = () => {
      if (!shouldReconnectRef.current) return;
      if (retriesRef.current >= 3) {
        setSocketStatus("disconnected");
        setSocketError("Chat disconnected. Use reconnect to try again.");
        return;
      }
      retriesRef.current += 1;
      setSocketStatus("reconnecting");
      retryTimerRef.current = window.setTimeout(connect, 500 * 2 ** (retriesRef.current - 1));
    };
  }, [friendId]);

  useEffect(() => {
    if (!chatQuery.data) return undefined;
    shouldReconnectRef.current = true;
    connect();
    return () => {
      shouldReconnectRef.current = false;
      window.clearTimeout(retryTimerRef.current);
      socketRef.current?.close();
    };
  }, [chatQuery.data, connect]);

  function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (socketRef.current?.readyState !== WebSocket.OPEN) {
      setSendError("Chat is not connected yet. Please wait or reconnect.");
      return;
    }
    socketRef.current.send(JSON.stringify({ content }));
    setDraft("");
    setSendError("");
  }

  function reconnect() {
    retriesRef.current = 0;
    setSocketError("");
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    window.clearTimeout(retryTimerRef.current);
    connect();
  }

  if (chatQuery.isLoading) return <LoadingState label="Loading conversation..." />;
  if (chatQuery.error) {
    return <ErrorState error={chatQuery.error} fallback="Could not load this conversation." />;
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <Link className="text-link" to="/connections">Back to connections</Link>
        <h1>{chatQuery.data.friend_name}</h1>
        <p className={`chat-status chat-status--${socketStatus}`} role="status">
          {socketStatus === "connected" ? "Live chat connected" : `Chat ${socketStatus}`}
        </p>
      </div>
      {socketError && (
        <div className="page-error" role="alert">
          {socketError}
          {socketStatus === "disconnected" && (
            <button className="button button-primary chat-reconnect" type="button" onClick={reconnect}>
              Reconnect
            </button>
          )}
        </div>
      )}
      <section className="chat-panel" aria-label={`Chat with ${chatQuery.data.friend_name}`}>
        <div className="chat-messages" aria-live="polite">
          {messages.length ? messages.map((message, index) => {
            const ownMessage = message.sender_id !== chatQuery.data.friend_id;
            const displayName = ownMessage ? "You" : chatQuery.data.friend_name;
            return (
              <article
                className={`chat-message${ownMessage ? " chat-message--own" : ""}`}
                key={message.id ?? `${message.sender_id}-${message.created_at ?? index}-${index}`}
              >
                <strong>{displayName}</strong>
                <p>{message.content}</p>
                <time>
                  {message.created_at
                    ? new Date(message.created_at).toLocaleString()
                    : message.time || ""}
                </time>
              </article>
            );
          }) : <p className="empty-state">Start the conversation with a kind message.</p>}
        </div>
        <form className="chat-compose" onSubmit={sendMessage}>
          <label className="visually-hidden" htmlFor="chat-message">Message</label>
          <textarea
            id="chat-message"
            value={draft}
            maxLength={4000}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a message..."
            rows={2}
          />
          <button className="button button-primary" type="submit" disabled={!draft.trim()}>
            Send
          </button>
        </form>
        {sendError && <p className="page-error" role="alert">{sendError}</p>}
      </section>
      <form
        className="game-invite-form"
        onSubmit={(event) => {
          event.preventDefault();
          inviteMutation.mutate();
        }}
      >
        <label className="form-field">
          Invite them to play
          <select value={gameName} onChange={(event) => setGameName(event.target.value)}>
            {games.map((game) => <option key={game}>{game}</option>)}
          </select>
        </label>
        <button className="button button-primary" type="submit" disabled={inviteMutation.isPending}>
          Send game invite
        </button>
        {inviteMutation.error && (
          <p className="page-error" role="alert">
            {inviteMutation.error.response?.data?.detail || "Could not send game invitation."}
          </p>
        )}
      </form>
    </section>
  );
}
