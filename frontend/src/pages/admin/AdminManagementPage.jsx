import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Check,
  Download,
  Eye,
  KeyRound,
  Pencil,
  RotateCcw,
  Search,
  ShieldOff,
  Stethoscope,
  User,
  UserPlus,
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
  const isDoctor = record.role === "doctor";
  const profile = record.doctor_profile || record;

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="admin-detail-dialog admin-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-detail-title"
      >
        <button className="admin-dialog-close" type="button" onClick={onClose} aria-label="Close details">
          <X size={20} aria-hidden="true" />
        </button>

        <span className="eyebrow">{isDoctor ? "Doctor profile" : "Patient account"}</span>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8 }}>
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={record.full_name} className="admin-detail-avatar" />
          ) : (
            <div className="admin-detail-avatar-fallback">
              {record.full_name?.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 id="admin-detail-title" style={{ margin: 0 }}>
              {isDoctor ? `Dr. ${record.full_name}` : record.full_name}
            </h2>
            {isDoctor && (
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {profile.qualification ? `${profile.qualification} · ` : ""}
                {profile.specialization || "Gynecologist"}
              </p>
            )}
          </div>
        </div>

        <section className="admin-form-section" style={{ marginTop: 20 }}>
          <h3 className="admin-form-section-title">Personal Information</h3>
          <dl className="admin-detail-list">
            <div><dt>Full Name</dt><dd>{record.full_name}</dd></div>
            <div><dt>Email</dt><dd>{record.email}</dd></div>
            <div><dt>Phone / Mobile</dt><dd>{record.mobile || "—"}</dd></div>
            <div><dt>Gender</dt><dd>{record.gender || "—"}</dd></div>
            <div><dt>Date of Birth</dt><dd>{record.date_of_birth || "—"}</dd></div>
            <div><dt>Registered Date</dt><dd>{formatDate(record.created_at)}</dd></div>
          </dl>
        </section>

        {isDoctor && (
          <section className="admin-form-section">
            <h3 className="admin-form-section-title">Professional Information</h3>
            <dl className="admin-detail-list">
              <div><dt>Medical Registration No.</dt><dd><strong>{profile.medical_reg_no || "—"}</strong></dd></div>
              <div><dt>Qualification</dt><dd>{profile.qualification || "—"}</dd></div>
              <div><dt>Specialization</dt><dd>{profile.specialization || "—"}</dd></div>
              <div><dt>Years of Experience</dt><dd>{profile.years_experience != null ? `${profile.years_experience} Years` : "—"}</dd></div>
              <div><dt>Hospital / Clinic Name</dt><dd>{profile.clinic_name || "—"}</dd></div>
              <div><dt>City / Address</dt><dd>{[profile.address, profile.city].filter(Boolean).join(", ") || "—"}</dd></div>
              <div><dt>Consultation Hours</dt><dd>{profile.consultation_hours || "—"}</dd></div>
              <div><dt>Consultation Fee</dt><dd>{profile.consultation_fee != null ? `₹${profile.consultation_fee}` : "—"}</dd></div>
            </dl>
            {profile.about && (
              <div style={{ marginTop: 12, padding: 12, background: "#fff", borderRadius: 8, border: "1px solid #eed8e2" }}>
                <dt style={{ fontWeight: 700, fontSize: "0.8rem", color: "#6b244a", marginBottom: 6 }}>Professional Biography</dt>
                <dd style={{ margin: 0, whiteSpace: "pre-wrap", color: "#3e2437" }}>{profile.about}</dd>
              </div>
            )}
          </section>
        )}

        <section className="admin-form-section">
          <h3 className="admin-form-section-title">Account & Platform Status</h3>
          <dl className="admin-detail-list">
            <div>
              <dt>Account Status</dt>
              <dd>
                <StatusBadge tone={record.is_removed ? "removed" : record.is_active ? "active" : "inactive"}>
                  {record.is_removed ? "Removed" : record.is_active ? "Active" : "Inactive"}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt>Approval Status</dt>
              <dd>
                <StatusBadge tone={record.approval_status || "approved"}>
                  {record.approval_status || "Approved"}
                </StatusBadge>
              </dd>
            </div>
            <div><dt>Decision Date</dt><dd>{formatDate(record.approval_decided_at)}</dd></div>
            <div><dt>Registered By Admin</dt><dd>{profile.registered_by_admin_id ? `Admin #${profile.registered_by_admin_id}` : "Direct Onboarding"}</dd></div>
            {record.admin_notes && (
              <div style={{ gridColumn: "span 2" }}><dt>Admin Notes</dt><dd>{record.admin_notes}</dd></div>
            )}
            {record.rejection_reason && (
              <div style={{ gridColumn: "span 2" }}><dt>Rejection Reason</dt><dd>{record.rejection_reason}</dd></div>
            )}
          </dl>
        </section>

        {record.appointments?.length > 0 && (
          <section className="admin-form-section">
            <h3 className="admin-form-section-title">Appointments ({record.appointments.length})</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                    <th>{isDoctor ? "Patient ID" : "Doctor ID"}</th>
                  </tr>
                </thead>
                <tbody>
                  {record.appointments.map((item) => (
                    <tr key={item.id}>
                      <td>{item.appointment_date}</td>
                      <td>{item.preferred_time || "—"}</td>
                      <td><StatusBadge tone={item.status}>{item.status}</StatusBadge></td>
                      <td>{isDoctor ? item.patient_id : item.doctor_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {record.approval_history?.length > 0 && (
          <section className="admin-form-section">
            <h3 className="admin-form-section-title">Approval History</h3>
            <ul className="compact-list">
              {record.approval_history.map((item, index) => (
                <li key={`${item.created_at}-${index}`}>
                  <strong>{item.decision}</strong> · {formatDate(item.created_at)}
                  {item.reason ? ` · ${item.reason}` : ""}
                </li>
              ))}
            </ul>
          </section>
        )}
      </section>
    </div>
  );
}

function RegisterDoctorModal({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    mobile: "",
    gender: "Female",
    date_of_birth: "",
    photo_url: "",
    medical_reg_no: "",
    qualification: "MBBS, MD (OBG)",
    specialization: "Gynecologist",
    years_experience: "",
    clinic_name: "",
    city: "Bangalore",
    address: "",
    consultation_hours: "Mon–Sat, 10 AM – 6 PM",
    consultation_fee: "",
    about: "",
    password: "",
    approval_status: "pending",
    is_active: false,
    send_invitation: true,
    notes: "",
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  function validate() {
    const errs = {};
    if (!formData.full_name.trim()) errs.full_name = "Full name is required.";
    if (!formData.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!formData.mobile.trim()) {
      errs.mobile = "Mobile number is required.";
    } else if (formData.mobile.trim().length < 7) {
      errs.mobile = "Enter a valid mobile number.";
    }
    if (!formData.medical_reg_no.trim()) {
      errs.medical_reg_no = "Medical registration number is required.";
    }
    if (!formData.qualification.trim()) {
      errs.qualification = "Medical qualification is required.";
    }
    if (!formData.specialization.trim()) {
      errs.specialization = "Specialization is required.";
    }
    if (!formData.clinic_name.trim()) {
      errs.clinic_name = "Hospital / Clinic name is required.";
    }
    if (!formData.address.trim()) {
      errs.address = "Clinic address is required.";
    }
    if (formData.password.trim().length < 8) {
      errs.password = "Temporary password must be at least 8 characters.";
    }
    if (formData.years_experience !== "" && (Number(formData.years_experience) < 0 || Number(formData.years_experience) > 80)) {
      errs.years_experience = "Years of experience must be between 0 and 80.";
    }
    if (formData.consultation_fee !== "" && Number(formData.consultation_fee) < 0) {
      errs.consultation_fee = "Consultation fee cannot be negative.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        mobile: formData.mobile.trim(),
        gender: formData.gender || null,
        date_of_birth: formData.date_of_birth || null,
        photo_url: formData.photo_url.trim() || null,
        medical_reg_no: formData.medical_reg_no.trim(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        years_experience: formData.years_experience !== "" ? Number(formData.years_experience) : null,
        clinic_name: formData.clinic_name.trim(),
        city: formData.city.trim() || "City",
        address: formData.address.trim(),
        consultation_hours: formData.consultation_hours.trim() || "Mon–Sat, 10 AM – 6 PM",
        consultation_fee: formData.consultation_fee !== "" ? Number(formData.consultation_fee) : null,
        about: formData.about.trim() || null,
        password: formData.password,
        approval_status: formData.approval_status,
        is_active: formData.approval_status === "approved" ? formData.is_active : false,
        send_invitation: formData.send_invitation,
        notes: formData.notes.trim() || null,
      };

      const result = await apiRequest("/admin/doctors", {
        method: "POST",
        data: payload,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      setApiError(err?.response?.data?.detail || "Could not register doctor.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="admin-detail-dialog admin-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-doctor-title"
      >
        <button className="admin-dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="eyebrow">Admin portal</span>
        <h2 id="register-doctor-title" style={{ marginTop: 4 }}>Register New Doctor</h2>
        <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
          Create the doctor account and professional clinic profile simultaneously.
        </p>

        {apiError && <p className="page-error" role="alert">{apiError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          {/* Section 1: Personal Information */}
          <div className="admin-form-section">
            <h3 className="admin-form-section-title">
              <User size={18} aria-hidden="true" /> 1. Personal Information
            </h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Full Name <span className="required-mark">*</span>
                <input
                  value={formData.full_name}
                  placeholder="Dr. Jane Doe"
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
                {errors.full_name && <span className="field-error">{errors.full_name}</span>}
              </label>

              <label className="form-field">
                Email Address <span className="required-mark">*</span>
                <input
                  type="email"
                  value={formData.email}
                  placeholder="doctor@example.com"
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>

              <label className="form-field">
                Mobile Number <span className="required-mark">*</span>
                <input
                  type="tel"
                  value={formData.mobile}
                  placeholder="+91 9876543210"
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
                {errors.mobile && <span className="field-error">{errors.mobile}</span>}
              </label>

              <label className="form-field">
                Gender
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>

              <label className="form-field">
                Date of Birth
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </label>

              <label className="form-field">
                Profile Photo URL
                <input
                  type="url"
                  placeholder="https://example.com/photo.jpg"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Section 2: Professional Information */}
          <div className="admin-form-section">
            <h3 className="admin-form-section-title">
              <Stethoscope size={18} aria-hidden="true" /> 2. Professional Information
            </h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Medical Registration Number <span className="required-mark">*</span>
                <input
                  value={formData.medical_reg_no}
                  placeholder="e.g. MCI-2015-84920"
                  onChange={(e) => setFormData({ ...formData, medical_reg_no: e.target.value })}
                />
                {errors.medical_reg_no && <span className="field-error">{errors.medical_reg_no}</span>}
              </label>

              <label className="form-field">
                Medical Qualification <span className="required-mark">*</span>
                <input
                  value={formData.qualification}
                  placeholder="MBBS, MD, MS, DGO, etc."
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                />
                {errors.qualification && <span className="field-error">{errors.qualification}</span>}
              </label>

              <label className="form-field">
                Specialization <span className="required-mark">*</span>
                <input
                  value={formData.specialization}
                  placeholder="Gynecologist, Endocrinologist, etc."
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
                {errors.specialization && <span className="field-error">{errors.specialization}</span>}
              </label>

              <label className="form-field">
                Years of Experience
                <input
                  type="number"
                  min="0"
                  max="80"
                  placeholder="e.g. 10"
                  value={formData.years_experience}
                  onChange={(e) => setFormData({ ...formData, years_experience: e.target.value })}
                />
                {errors.years_experience && <span className="field-error">{errors.years_experience}</span>}
              </label>

              <label className="form-field">
                Hospital / Clinic Name <span className="required-mark">*</span>
                <input
                  value={formData.clinic_name}
                  placeholder="e.g. Apollo Cradle / Lotus Women Care"
                  onChange={(e) => setFormData({ ...formData, clinic_name: e.target.value })}
                />
                {errors.clinic_name && <span className="field-error">{errors.clinic_name}</span>}
              </label>

              <label className="form-field">
                City <span className="required-mark">*</span>
                <input
                  value={formData.city}
                  placeholder="e.g. Bangalore"
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </label>

              <label className="form-field" style={{ gridColumn: "span 2" }}>
                Clinic Address <span className="required-mark">*</span>
                <input
                  value={formData.address}
                  placeholder="e.g. #42 5th Cross, Indiranagar"
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
                {errors.address && <span className="field-error">{errors.address}</span>}
              </label>

              <label className="form-field">
                Consultation Fee (₹)
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 700"
                  value={formData.consultation_fee}
                  onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                />
                {errors.consultation_fee && <span className="field-error">{errors.consultation_fee}</span>}
              </label>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Consultation Days and Timings
                <input
                  value={formData.consultation_hours}
                  placeholder="Mon–Sat, 10 AM – 6 PM"
                  onChange={(e) => setFormData({ ...formData, consultation_hours: e.target.value })}
                />
              </label>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Professional Biography
                <textarea
                  rows={3}
                  value={formData.about}
                  placeholder="Provide a summary of the doctor's clinical background, areas of expertise in PCOS/Gyno care, and patient philosophy..."
                  onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                />
              </label>
            </div>
          </div>

          {/* Section 3: Account & Approval Information */}
          <div className="admin-form-section">
            <h3 className="admin-form-section-title">
              <KeyRound size={18} aria-hidden="true" /> 3. Account Information & Platform Status
            </h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Approval Status
                <select
                  value={formData.approval_status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setFormData({
                      ...formData,
                      approval_status: status,
                      is_active: status === "approved",
                    });
                  }}
                >
                  <option value="approved">Approved (Active immediately)</option>
                  <option value="pending">Pending Admin Review</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label className="form-field">
                Account Status
                <select
                  disabled={formData.approval_status !== "approved"}
                  value={formData.is_active ? "active" : "inactive"}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "active" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="form-field" style={{ gridColumn: "span 2" }}>
                Temporary Password <span className="required-mark">*</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
                {errors.password && <span className="field-error">{errors.password}</span>}
                <small>Share this password with the doctor through a secure channel.</small>
              </label>

              <div className="form-field" style={{ gridColumn: "span 3" }}>
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.send_invitation}
                    onChange={(e) => setFormData({ ...formData, send_invitation: e.target.checked })}
                  />
                  <span>Notify the doctor with account setup or invitation instructions</span>
                </label>
              </div>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Admin Notes / Verification Remarks
                <input
                  value={formData.notes}
                  placeholder="e.g. Registered directly by Admin; medical degree and state council registration verified."
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Registering Doctor..." : "Register Doctor"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function EditDoctorModal({ record, isOpen, onClose, onSuccess }) {
  if (!isOpen || !record) return null;
  const profile = record.doctor_profile || record;

  const [formData, setFormData] = useState({
    full_name: record.full_name || "",
    email: record.email || "",
    mobile: record.mobile || profile.phone || "",
    gender: record.gender || "",
    date_of_birth: record.date_of_birth || "",
    photo_url: profile.photo_url || "",
    medical_reg_no: profile.medical_reg_no || "",
    qualification: profile.qualification || "",
    specialization: profile.specialization || "Gynecologist",
    years_experience: profile.years_experience != null ? String(profile.years_experience) : "",
    clinic_name: profile.clinic_name || "",
    city: profile.city || "",
    address: profile.address || "",
    consultation_hours: profile.consultation_hours || "Mon–Sat, 10 AM – 6 PM",
    consultation_fee: profile.consultation_fee != null ? String(profile.consultation_fee) : "",
    about: profile.about || "",
    approval_status: record.approval_status || "approved",
    is_active: record.is_active,
    admin_notes: record.admin_notes || "",
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!formData.full_name.trim()) errs.full_name = "Full name is required.";
    if (!formData.email.trim()) {
      errs.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = "Enter a valid email address.";
    }
    if (!formData.mobile.trim()) errs.mobile = "Mobile number is required.";
    if (!formData.medical_reg_no.trim()) errs.medical_reg_no = "Medical registration number is required.";
    if (!formData.qualification.trim()) errs.qualification = "Qualification is required.";
    if (!formData.clinic_name.trim()) errs.clinic_name = "Clinic name is required.";
    if (!formData.address.trim()) errs.address = "Address is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setApiError("");
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        mobile: formData.mobile.trim(),
        gender: formData.gender || null,
        date_of_birth: formData.date_of_birth || null,
        photo_url: formData.photo_url.trim() || null,
        medical_reg_no: formData.medical_reg_no.trim(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        years_experience: formData.years_experience !== "" ? Number(formData.years_experience) : null,
        clinic_name: formData.clinic_name.trim(),
        city: formData.city.trim() || "City",
        address: formData.address.trim(),
        consultation_hours: formData.consultation_hours.trim() || "Mon–Sat, 10 AM – 6 PM",
        consultation_fee: formData.consultation_fee !== "" ? Number(formData.consultation_fee) : null,
        about: formData.about.trim() || null,
        approval_status: formData.approval_status,
        is_active: formData.approval_status === "approved" ? formData.is_active : false,
        admin_notes: formData.admin_notes.trim() || null,
      };

      const result = await apiRequest(`/admin/doctors/${record.id}`, {
        method: "PUT",
        data: payload,
      });
      onSuccess(result);
      onClose();
    } catch (err) {
      setApiError(err?.response?.data?.detail || "Could not update doctor details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="admin-detail-dialog admin-modal-wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-doctor-title"
      >
        <button className="admin-dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="eyebrow">Doctor management</span>
        <h2 id="edit-doctor-title" style={{ marginTop: 4 }}>Edit Doctor Details</h2>
        <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
          Update personal, medical registration, or clinical details for Dr. {record.full_name}.
        </p>

        {apiError && <p className="page-error" role="alert">{apiError}</p>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="admin-form-section">
            <h3 className="admin-form-section-title">Personal Information</h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Full Name <span className="required-mark">*</span>
                <input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                />
                {errors.full_name && <span className="field-error">{errors.full_name}</span>}
              </label>

              <label className="form-field">
                Email Address <span className="required-mark">*</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                {errors.email && <span className="field-error">{errors.email}</span>}
              </label>

              <label className="form-field">
                Mobile Number <span className="required-mark">*</span>
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                />
                {errors.mobile && <span className="field-error">{errors.mobile}</span>}
              </label>

              <label className="form-field">
                Gender
                <select
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="">Select gender</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </label>

              <label className="form-field">
                Date of Birth
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                />
              </label>

              <label className="form-field">
                Profile Photo URL
                <input
                  type="url"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <h3 className="admin-form-section-title">Professional Information</h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Medical Registration Number <span className="required-mark">*</span>
                <input
                  value={formData.medical_reg_no}
                  onChange={(e) => setFormData({ ...formData, medical_reg_no: e.target.value })}
                />
                {errors.medical_reg_no && <span className="field-error">{errors.medical_reg_no}</span>}
              </label>

              <label className="form-field">
                Medical Qualification <span className="required-mark">*</span>
                <input
                  value={formData.qualification}
                  onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                />
                {errors.qualification && <span className="field-error">{errors.qualification}</span>}
              </label>

              <label className="form-field">
                Specialization <span className="required-mark">*</span>
                <input
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
                {errors.specialization && <span className="field-error">{errors.specialization}</span>}
              </label>

              <label className="form-field">
                Years of Experience
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={formData.years_experience}
                  onChange={(e) => setFormData({ ...formData, years_experience: e.target.value })}
                />
              </label>

              <label className="form-field">
                Hospital / Clinic Name <span className="required-mark">*</span>
                <input
                  value={formData.clinic_name}
                  onChange={(e) => setFormData({ ...formData, clinic_name: e.target.value })}
                />
                {errors.clinic_name && <span className="field-error">{errors.clinic_name}</span>}
              </label>

              <label className="form-field">
                City
                <input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </label>

              <label className="form-field" style={{ gridColumn: "span 2" }}>
                Clinic Address <span className="required-mark">*</span>
                <input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
                {errors.address && <span className="field-error">{errors.address}</span>}
              </label>

              <label className="form-field">
                Consultation Fee (₹)
                <input
                  type="number"
                  min="0"
                  value={formData.consultation_fee}
                  onChange={(e) => setFormData({ ...formData, consultation_fee: e.target.value })}
                />
              </label>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Consultation Days and Timings
                <input
                  value={formData.consultation_hours}
                  onChange={(e) => setFormData({ ...formData, consultation_hours: e.target.value })}
                />
              </label>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Professional Biography
                <textarea
                  rows={3}
                  value={formData.about}
                  onChange={(e) => setFormData({ ...formData, about: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="admin-form-section">
            <h3 className="admin-form-section-title">Account Status & Notes</h3>
            <div className="admin-form-grid-3">
              <label className="form-field">
                Approval Status
                <select
                  value={formData.approval_status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setFormData({
                      ...formData,
                      approval_status: status,
                      is_active: status === "approved" ? formData.is_active : false,
                    });
                  }}
                >
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label className="form-field">
                Account Status
                <select
                  disabled={formData.approval_status !== "approved"}
                  value={formData.is_active ? "active" : "inactive"}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value === "active" })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className="form-field" style={{ gridColumn: "span 3" }}>
                Admin Notes
                <input
                  value={formData.admin_notes}
                  placeholder="Internal administrator notes regarding this doctor..."
                  onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                />
              </label>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ResetPasswordModal({ record, isOpen, onClose, onSuccess }) {
  if (!isOpen || !record) return null;
  const [password, setPassword] = useState("");
  const [sendInvitation, setSendInvitation] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password.trim().length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiRequest(`/admin/doctors/${record.id}/reset-password`, {
        method: "POST",
        data: {
          new_password: password,
          send_invitation: sendInvitation,
        },
      });
      onSuccess(result?.message || `Password reset successfully for Dr. ${record.full_name}.`);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.detail || "Could not reset doctor password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="admin-dialog-backdrop"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="admin-detail-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-pass-title"
      >
        <button className="admin-dialog-close" type="button" onClick={onClose} aria-label="Close dialog">
          <X size={20} aria-hidden="true" />
        </button>
        <span className="eyebrow">Account Security</span>
        <h2 id="reset-pass-title" style={{ marginTop: 4 }}>Reset Password / Send Invitation</h2>
        <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
          Dr. {record.full_name} ({record.email})
        </p>

        {error && <p className="page-error" role="alert">{error}</p>}

        <form onSubmit={handleSubmit}>
          <div className="admin-form-section">
            <label className="form-field" style={{ marginTop: 12 }}>
              New Temporary Password <span className="required-mark">*</span>
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <small>Share the new password with the doctor through a secure channel.</small>
            </label>

            <label className="admin-checkbox-label" style={{ marginTop: 16 }}>
              <input
                type="checkbox"
                checked={sendInvitation}
                onChange={(e) => setSendInvitation(e.target.checked)}
              />
              <span>Send invitation & setup instructions notification to doctor</span>
            </label>
          </div>

          <div className="admin-modal-footer">
            <button type="button" className="button button-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="button button-primary" disabled={isSubmitting}>
              {isSubmitting ? "Resetting..." : "Confirm & Send"}
            </button>
          </div>
        </form>
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
      {showStatus && (
        <>
          <label className="form-field">
            Application date from
            <input type="date" value={state.dateFrom} onChange={(event) => setState({ ...state, dateFrom: event.target.value })} />
          </label>
          <label className="form-field">
            Application date to
            <input type="date" value={state.dateTo} onChange={(event) => setState({ ...state, dateTo: event.target.value })} />
          </label>
        </>
      )}
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
  const [registerOpen, setRegisterOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState(null);
  const [resetDoctor, setResetDoctor] = useState(null);
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
    } catch (err) {
      setRequestError(err?.response?.data?.detail || "Could not load account details.");
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
    } catch (err) {
      setRequestError(err?.response?.data?.detail || "Could not download the approval report.");
    }
  }

  return (
    <section className="content-page">
      <div className="admin-header-toolbar">
        <div>
          <span className="eyebrow">Admin portal</span>
          <h1 style={{ margin: "4px 0" }}>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {isPatient
              ? "Review patient accounts and preserve their clinical and appointment history."
              : isApproval
                ? "Review applications, record decisions, and export the currently filtered application list."
                : "Manage doctor access, register new doctors, and maintain complete clinic profiles."}
          </p>
        </div>
        {!isPatient && (
          <button
            type="button"
            className="admin-register-button"
            onClick={() => setRegisterOpen(true)}
          >
            <UserPlus size={18} aria-hidden="true" />
            + Register New Doctor
          </button>
        )}
      </div>

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
            <thead>
              <tr>
                <th>Patient</th><th>Email</th><th>Phone</th><th>Registered</th>
                <th>Account</th><th>Appointments</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.full_name}</td>
                  <td>{record.email}</td>
                  <td>{record.mobile || "—"}</td>
                  <td>{formatDate(record.created_at)}</td>
                  <td>
                    <StatusBadge tone={record.is_removed ? "removed" : record.is_active ? "active" : "inactive"}>
                      {record.is_removed ? "Removed" : record.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td>{record.appointment_count ?? 0}</td>
                  <td className="admin-action-cell">
                    <button className="admin-action admin-action--view" type="button" onClick={() => showDetails(record)}>
                      <Eye size={15} />View
                    </button>
                    {!record.is_removed && (
                      <button
                        className={`admin-action ${record.is_active ? "admin-action--deactivate" : "admin-action--activate"}`}
                        type="button"
                        disabled={accountAction.isPending}
                        onClick={() => changeStatus(record, record.is_active ? "inactive" : "active")}
                      >
                        {record.is_active ? <ShieldOff size={15} /> : <RotateCcw size={15} />}
                        {record.is_active ? "Deactivate" : "Reactivate"}
                      </button>
                    )}
                    {!record.is_removed && (
                      <button
                        className="admin-action admin-action--remove"
                        type="button"
                        disabled={accountAction.isPending}
                        onClick={() => changeStatus(record, "removed")}
                      >
                        <UserRoundX size={15} />Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table admin-record-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Reg. No & Qualification</th>
                <th>Email & Phone</th>
                <th>Specialization & Clinic</th>
                <th>Approval</th>
                <th>Account</th>
                <th>Registered</th>
                {!isApproval && <th>Appointments</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>Dr. {record.full_name}</strong>
                  </td>
                  <td>
                    {record.medical_reg_no ? (
                      <>
                        <span style={{ fontWeight: 600 }}>{record.medical_reg_no}</span>
                        {record.qualification && <div className="muted" style={{ fontSize: "0.8rem" }}>{record.qualification}</div>}
                      </>
                    ) : (
                      record.qualification || "—"
                    )}
                  </td>
                  <td>
                    {record.email}
                    {record.mobile && <div className="muted" style={{ fontSize: "0.8rem" }}>{record.mobile}</div>}
                  </td>
                  <td>
                    {record.specialization || "—"}
                    {record.clinic_name && <div className="muted" style={{ fontSize: "0.8rem" }}>{record.clinic_name}</div>}
                  </td>
                  <td>
                    <StatusBadge tone={record.approval_status || "approved"}>
                      {record.approval_status || "Approved"}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge tone={record.is_removed ? "removed" : record.is_active ? "active" : "inactive"}>
                      {record.is_removed ? "Removed" : record.is_active ? "Active" : "Inactive"}
                    </StatusBadge>
                  </td>
                  <td>{formatDate(record.created_at)}</td>
                  {!isApproval && <td>{record.appointment_count ?? 0}</td>}
                  <td className="admin-action-cell">
                    <button className="admin-action admin-action--view" type="button" onClick={() => showDetails(record)}>
                      <Eye size={15} />View
                    </button>
                    {!record.is_removed && (
                      <button className="admin-action admin-action--edit" type="button" onClick={() => setEditingDoctor(record)}>
                        <Pencil size={15} />Edit
                      </button>
                    )}
                    {!record.is_removed && (
                      <button className="admin-action admin-action--reset" type="button" onClick={() => setResetDoctor(record)}>
                        <KeyRound size={15} />Reset / Invite
                      </button>
                    )}
                    {isApproval ? (
                      record.approval_status === "pending" && (
                        <>
                          <label className="sr-only" htmlFor={`approval-note-${record.id}`}>Decision note for {record.full_name}</label>
                          <input
                            id={`approval-note-${record.id}`}
                            className="admin-decision-note"
                            value={notes[record.id] || ""}
                            maxLength={3000}
                            placeholder="Optional decision note"
                            onChange={(event) => setNotes({ ...notes, [record.id]: event.target.value })}
                          />
                          <button className="admin-action admin-action--approve" type="button" disabled={decision.isPending} onClick={() => decide(record, "approved")}>
                            <Check size={15} />Approve
                          </button>
                          <button className="admin-action admin-action--reject" type="button" disabled={decision.isPending} onClick={() => decide(record, "rejected")}>
                            <X size={15} />Reject
                          </button>
                        </>
                      )
                    ) : (
                      !record.is_removed && (
                        <>
                          <button
                            className={`admin-action ${record.is_active ? "admin-action--deactivate" : "admin-action--activate"}`}
                            type="button"
                            disabled={accountAction.isPending || (!record.is_active && record.approval_status !== "approved")}
                            onClick={() => changeStatus(record, record.is_active ? "inactive" : "active")}
                          >
                            {record.is_active ? <ShieldOff size={15} /> : <RotateCcw size={15} />}
                            {record.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                          <button
                            className="admin-action admin-action--remove"
                            type="button"
                            disabled={accountAction.isPending}
                            onClick={() => changeStatus(record, "removed")}
                          >
                            <UserRoundX size={15} />Remove
                          </button>
                        </>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailDialog record={detail} onClose={() => setDetail(null)} />

      <RegisterDoctorModal
        isOpen={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={(doctor) => {
          setFeedback(`Dr. ${doctor.full_name} has been successfully registered.`);
          queryClient.invalidateQueries({ queryKey: ["admin-management"] });
          queryClient.invalidateQueries({ queryKey: ["admin-approval-summary"] });
          queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        }}
      />

      <EditDoctorModal
        record={editingDoctor}
        isOpen={Boolean(editingDoctor)}
        onClose={() => setEditingDoctor(null)}
        onSuccess={(doctor) => {
          setFeedback(`Dr. ${doctor.full_name}'s details updated successfully.`);
          queryClient.invalidateQueries({ queryKey: ["admin-management"] });
          queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        }}
      />

      <ResetPasswordModal
        record={resetDoctor}
        isOpen={Boolean(resetDoctor)}
        onClose={() => setResetDoctor(null)}
        onSuccess={(msg) => {
          setFeedback(msg);
          queryClient.invalidateQueries({ queryKey: ["admin-management"] });
        }}
      />
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
      <header className="page-heading">
        <span className="eyebrow">Admin portal</span>
        <h1>Platform reports</h1>
        <p>Current account and appointment metrics from the Admin dashboard.</p>
      </header>
      <section className="summary-grid appointment-stat-grid" aria-label="Platform report metrics">
        {metrics.map(([label, value]) => (
          <article className="summary-card" key={label}>
            <h2>{label}</h2>
            <p>{value}</p>
          </article>
        ))}
      </section>
      <section className="summary-card">
        <h2>Recent appointment activity</h2>
        {data.recent_appointment_activity.length ? (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_appointment_activity.map((appointment) => (
                  <tr key={appointment.id}>
                    <td>{appointment.patient_name}</td>
                    <td>Dr. {appointment.doctor_name}</td>
                    <td>{appointment.appointment_date}</td>
                    <td>{appointment.preferred_time}</td>
                    <td>{appointment.status}</td>
                    <td>
                      <Link
                        className="text-link"
                        to={`/admin/appointments?patient_id=${encodeURIComponent(appointment.patient_id)}&doctor_id=${encodeURIComponent(appointment.doctor_id)}`}
                        aria-label={`View appointment ${appointment.id}`}
                      >
                        <Eye size={16} aria-hidden="true" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">No appointment activity to report yet.</p>
        )}
      </section>
    </section>
  );
}
