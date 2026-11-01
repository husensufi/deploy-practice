import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../../contexts/AuthContext.jsx";

const signupSchema = z
  .object({
    role: z.enum(["patient", "doctor"]),
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
        <p className="muted">Choose the account type that describes you.</p>
        {requestError && <p className="form-error" role="alert">{requestError}</p>}
        <form onSubmit={handleSubmit(submit)} noValidate>
          <fieldset className="role-field">
            <legend>I am a</legend>
            <label><input type="radio" value="patient" {...register("role")} /> Patient</label>
            <label><input type="radio" value="doctor" {...register("role")} /> Doctor</label>
          </fieldset>
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
          <label className="form-field">
            Password
            <input type="password" autoComplete="new-password" {...register("password")} />
            {errors.password && <span className="field-error">{errors.password.message}</span>}
          </label>
          <label className="form-field">
            Confirm password
            <input type="password" autoComplete="new-password" {...register("confirm_password")} />
            {errors.confirm_password && (
              <span className="field-error">{errors.confirm_password.message}</span>
            )}
          </label>
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
