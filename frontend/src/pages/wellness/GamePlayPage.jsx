import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const icons = ["💧", "🏃", "🥗", "😴", "🌿", "💗", "🧘", "🍵"];
const lanes = [0, 1, 2];

const cravingTree = {
  start: {
    question: "Sweet or savory right now?",
    options: [
      { label: "Sweet 🍯", next: "sweet1" },
      { label: "Savory 🧂", next: "savory1" },
    ],
  },
  sweet1: {
    question: "Warm or cold?",
    options: [
      { label: "Warm", next: "sweet_warm" },
      { label: "Cold", next: "sweet_cold" },
    ],
  },
  sweet_warm: {
    question: "Do you want something with chocolate?",
    options: [
      { label: "Yes please", result: { emoji: "🍫", name: "A square of dark chocolate", note: "A little dark chocolate can be a genuinely comforting, lower-sugar sweet fix." } },
      { label: "Not today", result: { emoji: "🍵", name: "Warm masala chai with jaggery", note: "Cosy, spiced, and gentle on you." } },
    ],
  },
  sweet_cold: {
    question: "Fruity or creamy?",
    options: [
      { label: "Fruity", result: { emoji: "🍉", name: "A bowl of chilled fruit chaat", note: "Naturally sweet and refreshing." } },
      { label: "Creamy", result: { emoji: "🍨", name: "A small scoop of ice cream", note: "Totally fine in moderation — enjoy it without guilt." } },
    ],
  },
  savory1: {
    question: "Crunchy or soft & comforting?",
    options: [
      { label: "Crunchy", next: "savory_crunchy" },
      { label: "Soft & comforting", next: "savory_soft" },
    ],
  },
  savory_crunchy: {
    question: "Spicy or mild?",
    options: [
      { label: "Spicy", result: { emoji: "🌶️", name: "Roasted masala makhana", note: "Crunchy, spiced, and much lighter than fried chips." } },
      { label: "Mild", result: { emoji: "🥜", name: "A handful of roasted nuts & seeds", note: "Great steady energy without a sugar crash." } },
    ],
  },
  savory_soft: {
    question: "Do you want it home-style?",
    options: [
      { label: "Yes, comfort food", result: { emoji: "🍲", name: "Warm khichdi or dal", note: "Simple, warm, and easy on your stomach on a low-energy day." } },
      { label: "Something light", result: { emoji: "🥗", name: "A fresh veggie salad bowl", note: "Light but still satisfying." } },
    ],
  },
};

function BubbleGame() {
  const [score, setScore] = useState(0);
  const [bubbles, setBubbles] = useState(() =>
    Array.from({ length: 14 }, (_, id) => ({ id, position: id })),
  );
  const nextBubbleId = useRef(14);

  function popBubble(id) {
    const newBubbleId = nextBubbleId.current++;
    setScore((value) => value + 1);
    setBubbles((current) => [
      ...current.filter((bubble) => bubble.id !== id),
      { id: newBubbleId, position: newBubbleId },
    ]);
  }

  return (
    <div className="bubble-game" aria-label="Zen Bubbles game">
      <p className="game-score" aria-live="polite">Popped: {score}</p>
      {bubbles.map(({ id, position }, index) => (
        <button
          className={`floating-bubble floating-bubble--${index % 5}`}
          style={{
            "--bubble-x": `${5 + ((position * 37) % 87)}%`,
            "--bubble-delay": `${-((position * 7) % 18)}s`,
          }}
          type="button"
          aria-label={`Pop bubble ${id + 1}`}
          key={id}
          onClick={() => popBubble(id)}
        />
      ))}
      <p className="bubble-hint">Click any floating bubble to pop it. No timer, no rush.</p>
    </div>
  );
}

function RunnerGame() {
  const [started, setStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [lane, setLane] = useState(1);
  const [score, setScore] = useState(0);
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const itemsRef = useRef(items);
  const laneRef = useRef(lane);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    laneRef.current = lane;
  }, [lane]);

  useEffect(() => {
    if (!started || gameOver) return undefined;
    const timer = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 650);
    return () => window.clearInterval(timer);
  }, [gameOver, started]);

  useEffect(() => {
    if (!started || gameOver || tick === 0) return;
    const spawned = {
      id: `${tick}-${Math.random()}`,
      lane: Math.floor(Math.random() * 3),
      type: Math.random() < 0.35 ? "heart" : "cloud",
      row: 0,
    };
    let points = 0;
    let collision = false;
    const remaining = itemsRef.current.flatMap((item) => {
      const nextRow = item.row + 1;
      if (nextRow < 4) return [{ ...item, row: nextRow }];
      if (item.lane === laneRef.current) {
        if (item.type === "heart") points += 5;
        else collision = true;
      } else if (item.type === "cloud") {
        points += 1;
      }
      return [];
    });
    itemsRef.current = [...remaining, spawned];
    setItems(itemsRef.current);
    if (points) setScore((value) => value + points);
    if (collision) setGameOver(true);
  }, [gameOver, started, tick]);

  useEffect(() => {
    function move(event) {
      if (!started || gameOver) return;
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
        setLane((value) => Math.max(0, value - 1));
      }
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
        setLane((value) => Math.min(2, value + 1));
      }
    }
    window.addEventListener("keydown", move);
    return () => window.removeEventListener("keydown", move);
  }, [gameOver, started]);

  function start() {
    setLane(1);
    setScore(0);
    itemsRef.current = [];
    setItems([]);
    setTick(0);
    setGameOver(false);
    setStarted(true);
  }

  return (
    <div className="runner-game">
      <p className="game-score" aria-live="polite">Score: {score}</p>
      <p>Use ← / → or A / D to switch lanes. Dodge grey stress clouds and collect pink hearts.</p>
      <div className="runner-track" aria-label="Three-lane runner">
        {lanes.map((trackLane) => (
          <div className="runner-lane" key={trackLane}>
            {items.filter((item) => item.lane === trackLane).map((item) => (
              <span className={`runner-item runner-item--${item.type}`} style={{ "--row": item.row }} key={item.id}>
                {item.type === "heart" ? "💗" : "☁️"}
              </span>
            ))}
            {lane === trackLane && <span className="runner-player" aria-label="Player">🟣</span>}
          </div>
        ))}
      </div>
      {!started && <button className="button button-primary" type="button" onClick={start}>Start run</button>}
      {gameOver && (
        <div className="game-result" role="status">
          <h3>Run over</h3>
          <p>Final score: {score}</p>
          <button className="button button-primary" type="button" onClick={start}>Play again</button>
        </div>
      )}
      {started && !gameOver && (
        <div className="runner-controls" aria-label="Lane controls">
          <button className="button button-secondary" type="button" aria-label="Move left" onClick={() => setLane((value) => Math.max(0, value - 1))}>← Left</button>
          <span>Lane {lane + 1}</span>
          <button className="button button-secondary" type="button" aria-label="Move right" onClick={() => setLane((value) => Math.min(2, value + 1))}>Right →</button>
        </div>
      )}
    </div>
  );
}

function shuffleCards() {
  return [...icons, ...icons]
    .map((icon) => ({ icon, sort: Math.random() }))
    .sort((left, right) => left.sort - right.sort)
    .map(({ icon }) => icon);
}

function MatchGame() {
  const deck = useMemo(shuffleCards, []);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (flipped.length !== 2) return undefined;
    setMoves((value) => value + 1);
    if (deck[flipped[0]] === deck[flipped[1]]) {
      setMatched((current) => [...current, ...flipped]);
      setFlipped([]);
      return undefined;
    }
    setLocked(true);
    const timer = window.setTimeout(() => {
      setFlipped([]);
      setLocked(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [deck, flipped]);

  function reveal(index) {
    if (locked || flipped.includes(index) || matched.includes(index)) return;
    setFlipped((current) => [...current, index]);
  }

  return (
    <div>
      <p className="game-score" aria-live="polite">Moves: {moves}</p>
      <div className="match-grid" aria-label="Mind Match cards">
        {deck.map((icon, index) => {
          const isShown = flipped.includes(index) || matched.includes(index);
          return (
            <button
              className={`match-card${isShown ? " match-card--flipped" : ""}${matched.includes(index) ? " match-card--matched" : ""}`}
              type="button"
              aria-label={isShown ? `Card ${index + 1}: ${icon}` : `Reveal card ${index + 1}`}
              aria-pressed={isShown}
              key={index}
              onClick={() => reveal(index)}
            >
              {isShown ? icon : "✦"}
            </button>
          );
        })}
      </div>
      {matched.length === deck.length && <p className="success-message" role="status">🎉 You matched them all!</p>}
    </div>
  );
}

function CravingGame() {
  const [current, setCurrent] = useState("start");
  const [result, setResult] = useState(null);
  const node = cravingTree[current];

  function choose(option) {
    if (option.result) setResult(option.result);
    else setCurrent(option.next);
  }

  function restart() {
    setCurrent("start");
    setResult(null);
  }

  return (
    <section className="craving-box" aria-live="polite">
      {result ? (
        <div className="craving-result">
          <span aria-hidden="true">{result.emoji}</span>
          <h2>{result.name}</h2>
          <p>{result.note}</p>
          <button className="button button-primary" type="button" onClick={restart}>Play again</button>
        </div>
      ) : (
        <>
          <h2>{node.question}</h2>
          <div className="craving-options">
            {node.options.map((option) => (
              <button className="button button-secondary" type="button" key={option.label} onClick={() => choose(option)}>
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

const gameComponents = {
  bubbles: BubbleGame,
  runner: RunnerGame,
  match: MatchGame,
  craving: CravingGame,
};

export default function GamePlayPage() {
  const { gameId } = useParams();
  const { data: games, isLoading, error } = useQuery({
    queryKey: ["wellness-games"],
    queryFn: () => apiRequest("/wellness/games"),
  });

  if (isLoading) return <LoadingState label="Loading game..." />;
  if (error) return <ErrorState error={error} fallback="Could not load this game." />;

  const game = games.find((entry) => entry.id === gameId);
  const Game = gameComponents[gameId];
  if (!game || !Game) {
    return (
      <section className="content-page wellness-page">
        <p className="page-error" role="alert">Game not found.</p>
        <Link className="text-link" to="/games">Back to games</Link>
      </section>
    );
  }

  return (
    <section className="content-page wellness-page">
      <p><Link className="text-link" to="/games">← Back to games</Link></p>
      <header className="page-heading">
        <span className="eyebrow">Wellness game</span>
        <h1>{game.name}</h1>
        <p>{game.description}</p>
      </header>
      <article className="summary-card game-play-card">
        <Game />
      </article>
    </section>
  );
}
