import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Check,
  Download,
  Eye,
  RotateCcw,
  Search,
  ShieldOff,
  UserRoundX,
  X,
} from "lucide-react";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiClient, apiRequest } from "../../services/api.js";

const LIMIT_OPTIONS = [
  ["10", "Top 10"],
  ["50", "Top 50"],
  ["100", "Top 100"],
  ["all", "All records"],
];

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function createFilters({ status, search, dateFrom, dateTo, limit }) {
  const params = new URLSearchParams({ approval_status: status, limit });
  if (search.trim()) params.set("search", search.trim());
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  return params.toString();
}

function StatusBadge({ children, tone }) {
  return <span className={`admin-status-badge admin-status-badge--${tone}`}>{children}</span>;
}

function DetailDialog({ record, onClose }) {
  if (!record) return null;
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-detail-title">
        <button className="admin-dialog-close" type="button" onClick={onClose} aria-label="Close details">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="eyebrow">{record.role === "doctor" ? "Doctor application" : "Patient account"}</span>
        <h2 id="admin-detail-title">{record.full_name}</h2>
        <dl className="admin-detail-list">
          <div><dt>Email</dt><dd>{record.email}</dd></div>
          <div><dt>Phone</dt><dd>{record.mobile || "—"}</dd></div>
          {record.role === "doctor" && <>
            <div><dt>Specialization</dt><dd>{record.specialization || record.doctor_profile?.specialization || "—"}</dd></div>
            <div><dt>Approval</dt><dd>{record.approval_status}</dd></div>
            <div><dt>Decision date</dt><dd>{formatDate(record.approval_decided_at)}</dd></div>
          </>}
          <div><dt>Registered</dt><dd>{formatDate(record.created_at)}</dd></div>
          <div><dt>Appointments</dt><dd>{record.appointment_count ?? record.appointments?.length ?? 0}</dd></div>
        </dl>
        {record.appointments?.length > 0 && (
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Status</th><th>Doctor ID</th></tr></thead>
              <tbody>{record.appointments.map((item) => (
                <tr key={item.id}><td>{item.appointment_date}</td><td>{item.status}</td><td>{item.doctor_id}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        {record.approval_history?.length > 0 && (
          <section>
            <h3>Approval history</h3>
            <ul className="compact-list">
              {record.approval_history.map((item, index) => (
                <li key={`${item.created_at}-${index}`}>
                  {item.decision} · {formatDate(item.created_at)}{item.reason ? ` · ${item.reason}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}

function FilterControls({ state, setState, showStatus = true }) {
  return (
    <div className="admin-filter-panel">
      {showStatus && (
        <label className="form-field">
          Approval status
          <select value={state.status} onChange={(event) => setState({ ...state, status: event.target.value })}>
            <option value="all">All applications</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      )}
      <label className="form-field admin-search-field">
        Search name or email
        <span className="admin-search-input">
          <Search size={16} aria-hidden="true" />
          <input value={state.search} onChange={(event) => setState({ ...state, search: event.target.value })} />
        </span>
      </label>
      {showStatus && <>
        <label className="form-field">
          Application date from
          <input type="date" value={state.dateFrom} onChange={(event) => setState({ ...state, dateFrom: event.target.value })} />
        </label>
        <label className="form-field">
          Application date to
          <input type="date" value={state.dateTo} onChange={(event) => setState({ ...state, dateTo: event.target.value })} />
        </label>
      </>}
      <label className="form-field">
        Records
        <select value={state.limit} onChange={(event) => setState({ ...state, limit: event.target.value })}>
          {LIMIT_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </select>
      </label>
    </div>
  );
}

export default function AdminManagementPage({ section }) {
  if (section === "reports") return <AdminReportsPage />;
  if (!["patients", "doctors", "approvals"].includes(section)) {
    throw new Error(`Unknown Admin section: ${section}`);
  }
  return <AdminAccountsPage section={section} />;
}

function AdminAccountsPage({ section }) {
  const queryClient = useQueryClient();
  const isPatient = section === "patients";
  const isApproval = section === "approvals";
  const [filters, setFilters] = useState({
    status: isApproval ? "pending" : "all",
    search: "",
    dateFrom: "",
    dateTo: "",
    limit: isApproval ? "10" : "all",
  });
  const [notes, setNotes] = useState({});
  const [detail, setDetail] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [requestError, setRequestError] = useState("");
  const queryString = useMemo(() => {
    const params = new URLSearchParams(createFilters(filters));
    if (isApproval) params.set("include_removed", "false");
    return params.toString();
  }, [filters, isApproval]);
  const patientQuery = new URLSearchParams({ limit: filters.limit });
  if (filters.search.trim()) patientQuery.set("search", filters.search.trim());
  const endpoint = isPatient
    ? `/admin/patients?${patientQuery.toString()}`
    : `/admin/doctors?${queryString}`;
  const accounts = useQuery({
    queryKey: ["admin-management", section, queryString],
    queryFn: () => apiRequest(endpoint),
  });
  const counts = useQuery({
    queryKey: ["admin-approval-summary"],
    queryFn: () => apiRequest("/admin/doctors/approval-summary"),
    enabled: isApproval,
  });
  const decision = useMutation({
    mutationFn: ({ doctorId, value }) =>
      apiRequest(`/admin/doctors/${doctorId}/decision`, { method: "POST", data: value }),
    onSuccess: () => {
      setFeedback("Doctor application decision saved.");
      queryClient.invalidateQueries({ queryKey: ["admin-management"] });
      queryClient.invalidateQueries({ queryKey: ["admin-approval-summary"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });
  const accountAction = useMutation({
    mutationFn: ({ id, role, status }) =>
      apiRequest(`/admin/${role}s/${id}/status`, {
        method: "POST",
        data: { status },
      }),
    onSuccess: (_result, variables) => {
      setFeedback(`${variables.role === "doctor" ? "Doctor" : "Patient"} account updated.`);
      queryClient.invalidateQueries({ queryKey: ["admin-management"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
  });

  if (accounts.isLoading) return <LoadingState label={`Loading ${section}...`} />;
  if (accounts.error) return <ErrorState error={accounts.error} fallback={`Could not load ${section}.`} />;
  const records = Array.isArray(accounts.data) ? accounts.data : [];
  const title = isPatient ? "Patients" : isApproval ? "Doctor approvals" : "Doctors";

  async function showDetails(record) {
    setDetail(null);
    try {
      const result = await apiRequest(`/admin/${record.role}s/${record.id}`);
      setDetail(result);
    } catch (requestError) {
      setRequestError(requestError?.response?.data?.detail || "Could not load account details.");
    }
  }

  function decide(doctor, nextDecision) {
    const note = notes[doctor.id]?.trim() || null;
    if (!window.confirm(`${nextDecision === "approved" ? "Approve" : "Reject"} ${doctor.full_name}'s doctor application?`)) return;
    decision.mutate({
      doctorId: doctor.id,
      value: nextDecision === "rejected"
        ? { decision: nextDecision, reason: note, notes: note }
        : { decision: nextDecision, notes: note },
    });
  }

  function changeStatus(record, nextStatus) {
    const action = nextStatus === "removed" ? "Remove" : nextStatus === "inactive" ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${action} ${record.full_name}'s account? Existing appointment and health history will be preserved.`)) return;
    accountAction.mutate({ id: record.id, role: record.role, status: nextStatus });
  }

  async function downloadReport() {
    setFeedback("");
    setRequestError("");
    try {
      const response = await apiClient.get(`/admin/doctors/approval-report.pdf?${queryString}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "doctor-approval-report.pdf";
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setFeedback("Approval report downloaded.");
    } catch (requestError) {
      setRequestError(requestError?.response?.data?.detail || "Could not download the approval report.");
    }
  }

  return (
    <section className="content-page">
      <header className="page-heading">
        <span className="eyebrow">Admin portal</span>
        <h1>{title}</h1>
        <p>{isPatient
          ? "Review patient accounts and preserve their clinical and appointment history."
          : isApproval
            ? "Review applications, record decisions, and export the currently filtered application list."
            : "Manage doctor access while keeping approval and appointment history intact."}</p>
      </header>
      {feedback && <p className="success-message" role="status">{feedback}</p>}
      {(requestError || decision.error || accountAction.error) && (
        <p className="page-error" role="alert">
          {requestError || (decision.error || accountAction.error)?.response?.data?.detail || "Could not complete the requested Admin action."}
        </p>
      )}
      {isApproval && (
        <>
          <section className="approval-count-grid" aria-label="Doctor approval totals">
            {["pending", "approved", "rejected"].map((item) => (
              <button
                type="button"
                className={`approval-count-card ${filters.status === item ? "is-selected" : ""}`}
                key={item}
                onClick={() => setFilters({ ...filters, status: item })}
              >
                <span>{item[0].toUpperCase() + item.slice(1)}</span>
                <strong>{counts.data?.[item] ?? "—"}</strong>
              </button>
            ))}
          </section>
          <div className="admin-filter-actions">
            <FilterControls state={filters} setState={setFilters} />
            <button type="button" className="button admin-download-button" onClick={downloadReport}>
              <Download size={17} aria-hidden="true" /> Download filtered PDF
            </button>
          </div>
        </>
      )}
      {!isApproval && (
        <FilterControls
          state={filters}
          setState={setFilters}
          showStatus={!isPatient}
        />
      )}
      {records.length === 0 ? (
        <p className="empty-state">No matching {isPatient ? "patients" : "doctor applications"} found.</p>
      ) : isPatient ? (
        <div className="table-scroll">
          <table className="data-table admin-record-table">
            <thead><tr>
              <th>Patient</th><th>Email</th><th>Phone</th><th>Registered</th>
              <th>Account</th><th>Appointments</th><th>Actions</th>
            </tr></thead>
            <tbody>{records.map((record) => (
                <tr key={record.id}>
                  <td>{record.full_name}</td><td>{record.email}</td><td>{record.mobile || "—"}</td>
                  <td>{formatDate(record.created_at)}</td>
                  <td><StatusBadge tone={record.is_removed ? "removed" : record.is_active ? "active" : "inactive"}>
                    {record.is_removed ? "Removed" : record.is_active ? "Active" : "Inactive"}
                  </StatusBadge></td>
                  <td>{record.appointment_count ?? 0}</td>
                  <td className="admin-action-cell">
                    <button className="admin-action admin-action--view" type="button" onClick={() => showDetails(record)}><Eye size={15} />View</button>
                    {!record.is_removed && <button
                      className={`admin-action ${record.is_active ? "admin-action--deactivate" : "admin-action--activate"}`}
                      type="button"
                      disabled={accountAction.isPending}
                      onClick={() => changeStatus(record, record.is_active ? "inactive" : "active")}
                    >{record.is_active ? <ShieldOff size={15} /> : <RotateCcw size={15} />}{record.is_active ? "Deactivate" : "Reactivate"}</button>}
                    {!record.is_removed && <button className="admin-action admin-action--remove" type="button" disabled={accountAction.isPending} onClick={() => changeStatus(record, "removed")}><UserRoundX size={15} />Remove</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table admin-record-table">
            <thead><tr>
              <th>Doctor</th><th>Email</th><th>Phone</th><th>Specialization</th>
              <th>Approval</th><th>Account</th><th>Registered</th>{!isApproval && <th>Appointments</th>}
              <th>Actions</th>
            </tr></thead>
            <tbody>{records.map((record) => (
              <tr key={record.id}>
                <td>{record.full_name}</td><td>{record.email}</td><td>{record.mobile || "—"}</td>
                <td>{record.specialization || "—"}</td>
                <td><StatusBadge tone={record.approval_status || "approved"}>{record.approval_status || "Approved"}</StatusBadge></td>
                <td><StatusBadge tone={record.is_removed ? "removed" : record.is_active ? "active" : "inactive"}>
                  {record.is_removed ? "Removed" : record.is_active ? "Active" : "Inactive"}
                </StatusBadge></td>
                <td>{formatDate(record.created_at)}</td>
                {!isApproval && <td>{record.appointment_count ?? 0}</td>}
                <td className="admin-action-cell">
                  <button className="admin-action admin-action--view" type="button" onClick={() => showDetails(record)}><Eye size={15} />View</button>
                  {isApproval ? <>
                    {record.approval_status === "pending" && <>
                      <label className="sr-only" htmlFor={`approval-note-${record.id}`}>Decision note for {record.full_name}</label>
                      <input id={`approval-note-${record.id}`} className="admin-decision-note" value={notes[record.id] || ""} maxLength={3000} placeholder="Optional decision note" onChange={(event) => setNotes({ ...notes, [record.id]: event.target.value })} />
                      <button className="admin-action admin-action--approve" type="button" disabled={decision.isPending} onClick={() => decide(record, "approved")}><Check size={15} />Approve</button>
                      <button className="admin-action admin-action--reject" type="button" disabled={decision.isPending} onClick={() => decide(record, "rejected")}><X size={15} />Reject</button>
                    </>}
                  </> : !record.is_removed && <>
                    <button
                      className={`admin-action ${record.is_active ? "admin-action--deactivate" : "admin-action--activate"}`}
                      type="button"
                      disabled={accountAction.isPending || (!record.is_active && record.approval_status !== "approved")}
                      onClick={() => changeStatus(record, record.is_active ? "inactive" : "active")}
                    >{record.is_active ? <ShieldOff size={15} /> : <RotateCcw size={15} />}{record.is_active ? "Deactivate" : "Reactivate"}</button>
                    <button className="admin-action admin-action--remove" type="button" disabled={accountAction.isPending} onClick={() => changeStatus(record, "removed")}><UserRoundX size={15} />Remove</button>
                  </>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <DetailDialog record={detail} onClose={() => setDetail(null)} />
    </section>
  );
}

function AdminReportsPage() {
  const report = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => apiRequest("/admin/dashboard"),
    refetchInterval: 30000,
  });
  if (report.isLoading) return <LoadingState label="Loading Admin reports..." />;
  if (report.error) return <ErrorState error={report.error} fallback="Could not load Admin reports." />;

  const data = report.data;
  const metrics = [
    ["Patients", data.total_patients],
    ["Doctors", data.total_doctors],
    ["Approved doctors", data.approved_doctors],
    ["Pending approvals", data.pending_doctor_approvals],
    ["Total appointments", data.total_appointments],
    ["Pending appointments", data.pending_appointments],
    ["Accepted appointments", data.accepted_appointments],
    ["Completed appointments", data.completed_appointments],
    ["Cancelled appointments", data.cancelled_appointments],
  ];
  return (
    <section className="content-page">
      <header className="page-heading"><span className="eyebrow">Admin portal</span><h1>Platform reports</h1><p>Current account and appointment metrics from the Admin dashboard.</p></header>
      <section className="summary-grid appointment-stat-grid" aria-label="Platform report metrics">
        {metrics.map(([label, value]) => <article className="summary-card" key={label}><h2>{label}</h2><p>{value}</p></article>)}
      </section>
      <section className="summary-card">
        <h2>Recent appointment activity</h2>
        {data.recent_appointment_activity.length ? <div className="table-scroll">
          <table className="data-table"><thead><tr><th>Patient</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>{data.recent_appointment_activity.map((appointment) => <tr key={appointment.id}>
              <td>{appointment.patient_name}</td><td>Dr. {appointment.doctor_name}</td><td>{appointment.appointment_date}</td><td>{appointment.preferred_time}</td><td>{appointment.status}</td>
              <td><Link className="text-link" to={`/admin/appointments?patient_id=${encodeURIComponent(appointment.patient_id)}&doctor_id=${encodeURIComponent(appointment.doctor_id)}`} aria-label={`View appointment ${appointment.id}`}><Eye size={16} aria-hidden="true" /> View</Link></td>
            </tr>)}</tbody>
          </table></div> : <p className="muted">No appointment activity to report yet.</p>}
      </section>
    </section>
  );
}
