import { useQuery } from "@tanstack/react-query";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

export default function DoctorsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => apiRequest("/doctors"),
  });

  if (isLoading) return <LoadingState label="Loading doctor directory..." />;
  if (error) return <ErrorState error={error} fallback="Could not load doctor directory." />;

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Doctor directory</span>
        <h1>Gynecologists</h1>
        <p>Profiles entered by doctors registered with GynoCare.</p>
      </div>
      {!data.length ? (
        <p className="empty-state">No doctor profiles have been registered yet.</p>
      ) : (
        <div className="doctor-grid">
          {data.map((doctor) => (
            <article className="summary-card doctor-card" key={doctor.id}>
              <div className="doctor-avatar" aria-hidden="true">
                {doctor.full_name.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <h2>Dr. {doctor.full_name}</h2>
                <p className="eyebrow">{doctor.specialization}</p>
                <p>{doctor.clinic_name}</p>
                <p className="muted">{doctor.address}, {doctor.city}</p>
                <p className="muted">{doctor.consultation_hours}</p>
                {doctor.about && <p>{doctor.about}</p>}
                <a className="text-link" href={`tel:${doctor.phone}`}>{doctor.phone}</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
