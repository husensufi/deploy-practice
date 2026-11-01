import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiClient, apiRequest } from "../../services/api.js";

function orderedLogs(logs) {
  return [...logs].reverse();
}

export default function ReportsPage() {
  const downloadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.get("/reports/pdf", {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "PCOS_Report.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiRequest("/reports"),
  });

  if (isLoading) return <LoadingState label="Loading your reports..." />;
  if (error) return <ErrorState error={error} fallback="Could not load your reports." />;

  const logs = orderedLogs(data.logs);
  return (
    <section className="content-page">
      <div className="page-heading heading-with-action">
        <div>
          <span className="eyebrow">Health reports</span>
          <h1>Your recent trends</h1>
          <p>Charts are based only on your saved tracker entries.</p>
        </div>
        <button
          className="button button-primary"
          type="button"
          onClick={() => downloadMutation.mutate()}
          disabled={downloadMutation.isPending}
        >
          {downloadMutation.isPending ? "Preparing PDF..." : "Download PDF"}
        </button>
      </div>
      {downloadMutation.error && (
        <ErrorState error={downloadMutation.error} fallback="Could not download the PDF report." />
      )}
      {!data.profile && (
        <p className="empty-state">
          No assessment is saved. <a href="/assessment">Complete an assessment</a> to include screening details.
        </p>
      )}
      {!logs.length ? (
        <p className="empty-state">
          No tracker entries yet. Save entries on the daily tracker to see health trends.
        </p>
      ) : (
        <div className="charts-grid">
          <article className="chart-card">
            <h2>Cramp pain trend</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="log_date" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="cramp_pain_level" name="Cramp pain" stroke="#d6667a" />
              </LineChart>
            </ResponsiveContainer>
          </article>
          <article className="chart-card">
            <h2>Sleep and exercise</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="log_date" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" dataKey="sleep_hours" name="Sleep (hours)" stroke="#2f7a6b" />
                <Line yAxisId="right" dataKey="exercise_minutes" name="Exercise (minutes)" stroke="#3f1b3d" />
              </LineChart>
            </ResponsiveContainer>
          </article>
          <article className="chart-card">
            <h2>Water intake</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={logs}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="log_date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="water_intake_liters" name="Water (litres)" fill="#2f7a6b" />
              </BarChart>
            </ResponsiveContainer>
          </article>
          <article className="summary-card">
            <h2>Saved screening result</h2>
            {data.screening_result ? (
              <>
                <p>{data.screening_result.risk_level} · score {data.screening_result.score}/{data.screening_result.max_score}</p>
                <p>BMI: {data.screening_result.bmi}</p>
                <p className="muted">This is a screening indicator, not a medical diagnosis.</p>
              </>
            ) : (
              <p className="muted">No screening result is available yet.</p>
            )}
          </article>
        </div>
      )}
    </section>
  );
}
