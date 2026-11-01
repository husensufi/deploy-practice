import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../../contexts/AuthContext.jsx";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export default function LoginPage() {
  const { login, user, status } = useAuth();
  const navigate = useNavigate();
  const [requestError, setRequestError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  if (status === "authenticated" && user) {
    return <Navigate to="/home" replace />;
  }

  async function submit(values) {
    setRequestError("");
    try {
      await login(values);
      navigate("/home", { replace: true });
    } catch (error) {
      setRequestError(
        error?.response?.data?.detail || "Unable to sign in. Check your details and try again.",
      );
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="login-heading">
        <span className="eyebrow">PCOS GynoCare</span>
        <h1 id="login-heading">Welcome back</h1>
        <p className="muted">Sign in to continue to your health portal.</p>
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <form onSubmit={handleSubmit(submit)} noValidate>
          <label className="form-field">
            Email address
            <input type="email" autoComplete="email" {...register("email")} />
            {errors.email && <span className="field-error">{errors.email.message}</span>}
          </label>
          <div className="form-field">
            <label htmlFor="login-password">Password</label>
            <div className="password-input-wrap">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          <button className="button button-primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
        <p className="auth-footer">
          New to GynoCare? <Link to="/signup">Create an account</Link>
        </p>
      </section>
    </main>
  );
}
