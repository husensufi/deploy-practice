import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const trackerSchema = z.object({
  on_period: z.boolean(),
  cramp_pain_level: z.coerce.number().int().min(0).max(10),
  water_intake_liters: z.coerce.number().min(0).max(100),
  exercise_minutes: z.coerce.number().int().min(0).max(1440),
  sleep_hours: z.coerce.number().min(0).max(24),
  mood: z.enum(["happy", "normal", "irritated", "sad", "anxious"]),
  junk_food: z.boolean(),
  notes: z.string().max(5000),
});

const initialValues = {
  on_period: false,
  cramp_pain_level: 0,
  water_intake_liters: 0,
  exercise_minutes: 0,
  sleep_hours: 0,
  mood: "normal",
  junk_food: false,
  notes: "",
};

export default function TrackerPage() {
  const queryClient = useQueryClient();
  const logsQuery = useQuery({
    queryKey: ["daily-logs"],
    queryFn: () => apiRequest("/tracker/daily?limit=14"),
  });
  const summaryQuery = useQuery({
    queryKey: ["tracker-summary"],
    queryFn: () => apiRequest("/tracker/summary"),
  });
  const mutation = useMutation({
    mutationFn: (values) =>
      apiRequest("/tracker/daily", { method: "POST", data: values }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["daily-logs"] });
      await queryClient.invalidateQueries({ queryKey: ["tracker-summary"] });
      await queryClient.invalidateQueries({ queryKey: ["patient-dashboard"] });
    },
  });
  const { register, handleSubmit, reset, watch } = useForm({
    resolver: zodResolver(trackerSchema),
    defaultValues: initialValues,
  });
  const crampLevel = watch("cramp_pain_level");
  const today = summaryQuery.data?.today_date;
  const todayLog = logsQuery.data?.find((log) => log.log_date === today);

  useEffect(() => {
    if (logsQuery.isSuccess && today) {
      const current = logsQuery.data.find((log) => log.log_date === today);
      if (current) {
        const { id, user_id, log_date, created_at, ...values } = current;
        reset(values);
      }
    }
  }, [logsQuery.data, logsQuery.isSuccess, reset, today]);

  if (logsQuery.isLoading || summaryQuery.isLoading) {
    return <LoadingState label="Loading your tracker..." />;
  }
  if (logsQuery.error || summaryQuery.error) {
    return (
      <ErrorState
        error={logsQuery.error || summaryQuery.error}
        fallback="Could not load tracker history."
      />
    );
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Daily health tracker</span>
        <h1>Today's entry</h1>
        <p>{new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
      </div>
      <form className="form-card" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label className="checkbox-field">
          <input type="checkbox" {...register("on_period")} /> I'm on my period today
        </label>
        <label className="form-field">
          Cramp pain (0-10): <output>{crampLevel}</output>
          <input type="range" min="0" max="10" {...register("cramp_pain_level")} />
        </label>
        <div className="form-grid">
          <label className="form-field">Water intake (litres)
            <input type="number" min="0" step="0.1" {...register("water_intake_liters")} />
          </label>
          <label className="form-field">Exercise (minutes)
            <input type="number" min="0" {...register("exercise_minutes")} />
          </label>
          <label className="form-field">Sleep (hours)
            <input type="number" min="0" max="24" step="0.5" {...register("sleep_hours")} />
          </label>
          <label className="form-field">Mood
            <select {...register("mood")}>
              <option value="happy">Happy</option>
              <option value="normal">Normal</option>
              <option value="irritated">Irritated</option>
              <option value="sad">Sad</option>
              <option value="anxious">Anxious</option>
            </select>
          </label>
        </div>
        <label className="checkbox-field">
          <input type="checkbox" {...register("junk_food")} /> Ate junk or processed food today
        </label>
        <label className="form-field">Notes
          <textarea rows="3" {...register("notes")} />
        </label>
        {mutation.error && <ErrorState error={mutation.error} fallback="Could not save today's entry." />}
        <button className="button button-primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : todayLog ? "Update today's entry" : "Save today's entry"}
        </button>
      </form>
      <section className="history-section">
        <h2>Recent history</h2>
        {!logsQuery.data.length ? (
          <p className="empty-state">No entries yet. Save today's entry to start tracking.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Period</th><th>Cramp</th><th>Water</th><th>Exercise</th><th>Sleep</th><th>Mood</th></tr></thead>
              <tbody>
                {logsQuery.data.map((log) => (
                  <tr key={log.id}>
                    <td>{log.log_date}</td><td>{log.on_period ? "Yes" : "No"}</td>
                    <td>{log.cramp_pain_level}</td><td>{log.water_intake_liters} L</td>
                    <td>{log.exercise_minutes} min</td><td>{log.sleep_hours} h</td><td>{log.mood}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
