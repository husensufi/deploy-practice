import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

function BreathingGuide() {
  const [active, setActive] = useState(false);
  const [inhale, setInhale] = useState(true);

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setTimeout(() => setInhale((value) => !value), inhale ? 4000 : 6000);
    return () => window.clearTimeout(timer);
  }, [active, inhale]);

  return (
    <section className="breathing-card" aria-labelledby="breathing-heading">
      <div className={`breathing-orb${active && inhale ? " breathing-orb--expanded" : ""}`} aria-hidden="true">
        <span>{active ? (inhale ? "Breathe in" : "Breathe out") : "Breathe"}</span>
      </div>
      <div>
        <h2 id="breathing-heading">Breathe with the circle</h2>
        <p className="muted">Follow a gentle 4-second inhale and 6-second exhale.</p>
        <button
          className="button button-primary"
          type="button"
          onClick={() => {
            setInhale(true);
            setActive((value) => !value);
          }}
        >
          {active ? "Pause breathing guide" : "Start breathing guide"}
        </button>
      </div>
    </section>
  );
}

function GuidedSession({ tutorials, onClose }) {
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(tutorials[0].duration_seconds);
  const [finished, setFinished] = useState(false);
  const current = tutorials[index];

  useEffect(() => {
    if (finished) return undefined;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished]);

  useEffect(() => {
    if (remaining !== 0 || finished) return;
    if (index + 1 >= tutorials.length) {
      setFinished(true);
      return;
    }
    setIndex((value) => value + 1);
    setRemaining(tutorials[index + 1].duration_seconds);
  }, [finished, index, remaining, tutorials]);

  return (
    <div className="wellness-dialog-backdrop">
      <section className="wellness-dialog" role="dialog" aria-modal="true" aria-labelledby="session-title">
        {finished ? (
          <>
            <p className="wellness-game-icon" aria-hidden="true">🎉</p>
            <h2 id="session-title">Session complete. Well done!</h2>
            <p className="muted">You completed the original six-step guided sequence.</p>
          </>
        ) : (
          <>
            <p className="wellness-game-icon" aria-hidden="true">{current.id === "breathing" ? "🌬️" : "🧘"}</p>
            <p className="eyebrow">Pose {index + 1} of {tutorials.length}</p>
            <h2 id="session-title">{current.name}</h2>
            <p className="muted">{current.description}</p>
            <p className="session-count" aria-live="polite">{remaining}</p>
          </>
        )}
        <button className="button button-primary" type="button" onClick={onClose}>
          {finished ? "Close session" : "Stop session"}
        </button>
      </section>
    </div>
  );
}

export default function MovementPage() {
  const [sessionOpen, setSessionOpen] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["wellness-tutorials"],
    queryFn: () => apiRequest("/wellness/tutorials"),
  });

  if (isLoading) return <LoadingState label="Loading movement tutorials..." />;
  if (error) return <ErrorState error={error} fallback="Could not load movement tutorials." />;

  const poses = data.tutorials.filter((tutorial) => tutorial.category === "Yoga");
  const breathing = data.tutorials.filter((tutorial) => tutorial.category === "Breathing");

  return (
    <section className="content-page wellness-page">
      <header className="page-heading">
        <span className="eyebrow">Gentle movement</span>
        <h1>Yoga &amp; movement for PCOS</h1>
        <p>Follow the original gentle poses, browse step-by-step instructions, or try the timed guided session.</p>
      </header>
      <p className="medical-disclaimer">{data.disclaimer}</p>
      <div className="wellness-poster-strip" aria-label="Movement encouragement">
        <p>Move gently. Heal steadily.</p>
        <p>PCOS is part of your story, not all of it.</p>
        <p>Small steps every day add up.</p>
      </div>
      <BreathingGuide />
      <section className="wellness-section" aria-labelledby="yoga-tutorials-heading">
        <div className="heading-with-action">
          <div>
            <h2 id="yoga-tutorials-heading">Yoga poses</h2>
            <p className="muted">Each pose is shown for 30 seconds in the legacy guided sequence.</p>
          </div>
          <button
            className="button button-primary"
            type="button"
            onClick={() => setSessionOpen(true)}
            disabled={!data.tutorials.length}
          >
            Start guided session
          </button>
        </div>
        <div className="wellness-card-grid">
          {poses.map((tutorial, index) => (
            <article className="wellness-card" key={tutorial.id}>
              <div className={`wellness-card-art wellness-card-art--${index + 1}`} aria-hidden="true">
                {["🦋", "🐍", "🧎‍♀️", "🌉", "🐈"][index]}
              </div>
              <div className="wellness-card-body">
                <p className="wellness-card-meta">{tutorial.difficulty} · 30 seconds</p>
                <h3>{tutorial.name}</h3>
                <p>{tutorial.description}</p>
                <Link className="button button-primary" to={`/movement/${tutorial.id}`}>View instructions</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="wellness-section" aria-labelledby="breathing-tutorial-heading">
        <h2 id="breathing-tutorial-heading">Breathing practice</h2>
        {breathing.map((tutorial) => (
          <article className="wellness-card wellness-card--horizontal" key={tutorial.id}>
            <div className="wellness-card-art wellness-card-art--6" aria-hidden="true">🌬️</div>
            <div className="wellness-card-body">
              <p className="wellness-card-meta">{tutorial.difficulty} · 30 seconds in guided sequence</p>
              <h3>{tutorial.name}</h3>
              <p>{tutorial.description}</p>
              <Link className="button button-primary" to={`/movement/${tutorial.id}`}>View instructions</Link>
            </div>
          </article>
        ))}
      </section>
      <section className="exercise-source-note" aria-labelledby="exercise-note-heading">
        <h2 id="exercise-note-heading">Exercise tracking</h2>
        <p>
          The legacy app does not contain a separate exercise-routine tutorial catalog.
          It records daily exercise minutes in the existing tracker instead.
        </p>
        <Link className="text-link" to="/tracker">Record today's exercise minutes</Link>
      </section>
      {sessionOpen && (
        <GuidedSession tutorials={data.tutorials} onClose={() => setSessionOpen(false)} />
      )}
    </section>
  );
}
