export function LoadingState({ label = "Loading..." }) {
  return <p className="page-status" role="status">{label}</p>;
}

export function ErrorState({ error, fallback = "The request could not be completed." }) {
  const message =
    error?.response?.data?.detail ||
    (error?.response?.status ? `${fallback} (HTTP ${error.response.status})` : fallback);
  return <p className="page-error" role="alert">{message}</p>;
}
