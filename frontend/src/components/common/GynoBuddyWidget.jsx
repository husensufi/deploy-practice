import { useState } from "react";

import { apiRequest } from "../../services/api.js";

export default function GynoBuddyWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: "user", content }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);

    try {
      const response = await apiRequest("/ai/patient/gynobuddy/chat", {
        method: "POST",
        data: {
          messages: nextMessages.filter((message) => message.role !== "error"),
        },
      });
      setMessages([...nextMessages, { role: "assistant", content: response.reply }]);
    } catch (error) {
      setMessages([
        ...messages,
        {
          role: "error",
          content:
            error?.response?.data?.detail ||
            "GynoBuddy is unavailable right now. Please try again.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <aside className="gynobuddy">
      {isOpen ? (
        <section className="gynobuddy-panel" aria-label="GynoBuddy chat">
          <header className="gynobuddy-header">
            <div>
              <strong>Ask GynoBuddy</strong>
              <span>Supportive guidance, not a medical diagnosis</span>
            </div>
            <button
              type="button"
              className="gynobuddy-close"
              aria-label="Close GynoBuddy chat"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </header>
          <div className="gynobuddy-messages" aria-live="polite">
            {messages.length === 0 && (
              <p className="gynobuddy-empty">
                Ask a question about PCOS, self-care, or using the app.
              </p>
            )}
            {messages.map((message, index) => (
              <p
                className={`gynobuddy-message gynobuddy-message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                {message.content}
              </p>
            ))}
            {isSending && <p className="gynobuddy-typing">GynoBuddy is responding...</p>}
          </div>
          <form className="gynobuddy-form" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="gynobuddy-message">
              Your message
            </label>
            <textarea
              id="gynobuddy-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Write a message..."
              maxLength={4000}
              rows={2}
              disabled={isSending}
            />
            <button
              type="submit"
              className="button button-primary"
              disabled={isSending || !draft.trim()}
            >
              Send
            </button>
          </form>
        </section>
      ) : (
        <button
          type="button"
          className="gynobuddy-launch"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          Ask GynoBuddy
        </button>
      )}
    </aside>
  );
}
