import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

export default function MovementTutorialPage() {
  const { tutorialId } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["wellness-tutorial", tutorialId],
    queryFn: () => apiRequest(`/wellness/tutorials/${tutorialId}`),
    retry: false,
  });

  if (isLoading) return <LoadingState label="Loading tutorial..." />;
  if (error) return <ErrorState error={error} fallback="Could not load this tutorial." />;

  return (
    <section className="content-page wellness-page">
      <p><Link className="text-link" to="/movement">← Back to Yoga &amp; movement</Link></p>
      <header className="page-heading">
        <span className="eyebrow">{data.category} · {data.difficulty} · {data.duration_seconds} seconds</span>
        <h1>{data.name}</h1>
        <p>{data.description}</p>
      </header>
      <article className="summary-card tutorial-instructions">
        <h2>Step-by-step instructions</h2>
        <ol>
          {data.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}
        </ol>
        <p className="medical-disclaimer">
          Stop if you feel pain, dizziness, or discomfort, and ask your clinician if you are unsure whether a pose is suitable for you.
        </p>
        <a className="button button-primary" href={data.video_search_url} target="_blank" rel="noreferrer">
          Watch tutorial videos
        </a>
      </article>
    </section>
  );
}
