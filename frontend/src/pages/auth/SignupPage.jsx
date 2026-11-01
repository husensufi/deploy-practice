import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../../contexts/AuthContext.jsx";

const signupSchema = z
  .object({
    role: z.literal("patient"),
    full_name: z.string().trim().min(1, "Enter your full name."),
    email: z.string().email("Enter a valid email address."),
    mobile: z.string().trim().min(1, "Enter your mobile number."),
    password: z.string().min(1, "Enter a password."),
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((value) => value.password === value.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match.",
  });

export default function SignupPage() {
  const { register: createAccount, user, status } = useAuth();
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "patient" },
  });

  if (status === "authenticated" && user) {
    return <Navigate to="/home" replace />;
  }

  async function submit(values) {
    setRequestError("");
    try {
      await createAccount(values);
      navigate("/home", { replace: true });
    } catch (error) {
      setRequestError(
        error?.response?.data?.detail || "Unable to create your account. Please try again.",
      );
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="signup-heading">
        <span className="eyebrow">PCOS GynoCare</span>
        <h1 id="signup-heading">Create your account</h1>
        <p className="muted">Create a patient account to access health tracking and appointment services.</p>
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <form onSubmit={handleSubmit(submit)} noValidate>
          <input type="hidden" value="patient" {...register("role")} />
          <label className="form-field">
            Full name
            <input autoComplete="name" {...register("full_name")} />
            {errors.full_name && <span className="field-error">{errors.full_name.message}</span>}
          </label>
          <label className="form-field">
            Email address
            <input type="email" autoComplete="email" {...register("email")} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>
          <label className="form-field">
            Mobile number
            <input type="tel" autoComplete="tel" {...register("mobile")} />
            {errors.mobile && <span className="field-error">{errors.mobile.message}</span>}
          </label>
          <div className="form-field">
            <label htmlFor="signup-password">Password</label>
            <div className="password-input-wrap">
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                {...register("password")}
              />
              <button
                className="password-visibility-button"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword
                  ? <EyeOff size={19} aria-hidden="true" />
                  : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="signup-confirm-password">Confirm password</label>
            <div className="password-input-wrap">
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                {...register("confirm_password")}
              />
              <button
                className="password-visibility-button"
                type="button"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                aria-pressed={showConfirmPassword}
                onClick={() => setShowConfirmPassword((visible) => !visible)}
              >
                {showConfirmPassword
                  ? <EyeOff size={19} aria-hidden="true" />
                  : <Eye size={19} aria-hidden="true" />}
              </button>
            </div>
            {errors.confirm_password && (
              <span className="field-error">{errors.confirm_password.message}</span>
            )}
          </div>
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
        <p className="auth-footer">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
