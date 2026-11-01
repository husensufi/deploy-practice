import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const profileSchema = z.object({
  clinic_name: z.string().trim().min(1),
  specialization: z.string().trim().min(1),
  city: z.string().trim().min(1),
  address: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  years_experience: z.number().int().min(0).max(80).nullable(),
  consultation_hours: z.string(),
  about: z.string(),
  photo_url: z.string(),
});

const defaults = {
  clinic_name: "",
  specialization: "Gynecologist",
  city: "",
  address: "",
  phone: "",
  years_experience: null,
  consultation_hours: "Mon–Sat, 10 AM – 6 PM",
  about: "",
  photo_url: "",
};

export default function DoctorProfilePage() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({
    queryKey: ["doctor-profile"],
    queryFn: () => apiRequest("/doctors/me"),
  });
  const mutation = useMutation({
    mutationFn: (values) =>
      apiRequest("/doctors/me", { method: "PUT", data: values }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctor-profile"] }),
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: defaults,
  });
  const { ref: experienceRef, ...experienceField } = register("years_experience", {
    setValueAs: (value) => value === "" ? null : Number(value),
  });

  useEffect(() => {
    if (profileQuery.isSuccess && profileQuery.data) {
      reset({ ...defaults, ...profileQuery.data });
    }
  }, [profileQuery.data, profileQuery.isSuccess, reset]);

  if (profileQuery.isLoading) return <LoadingState label="Loading your clinic profile..." />;
  if (profileQuery.error) {
    return <ErrorState error={profileQuery.error} fallback="Could not load your clinic profile." />;
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Doctor portal</span>
        <h1>Clinic profile</h1>
        <p>This information appears in the patient-facing doctor directory.</p>
      </div>
      <form className="form-card" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="form-grid">
          <label className="form-field">Clinic / hospital name
            <input {...register("clinic_name")} />
            {errors.clinic_name && <span className="field-error">Enter a clinic name.</span>}
          </label>
          <label className="form-field">Specialization
            <input {...register("specialization")} />
          </label>
          <label className="form-field">City
            <input {...register("city")} />
            {errors.city && <span className="field-error">Enter a city.</span>}
          </label>
          <label className="form-field">Clinic phone
            <input type="tel" {...register("phone")} />
            {errors.phone && <span className="field-error">Enter a phone number.</span>}
          </label>
          <label className="form-field">Years of experience
            <input
              type="number"
              min="0"
              max="80"
              step="1"
              placeholder="Optional"
              {...experienceField}
              ref={experienceRef}
            />
            {errors.years_experience && <span className="field-error">Enter a number from 0 to 80.</span>}
          </label>
          <label className="form-field field-span">Address
            <input {...register("address")} />
            {errors.address && <span className="field-error">Enter an address.</span>}
          </label>
          <label className="form-field">Consultation hours
            <input {...register("consultation_hours")} />
          </label>
          <label className="form-field">Photo URL (optional)
            <input type="url" {...register("photo_url")} />
          </label>
          <label className="form-field field-span">About / qualifications
            <textarea rows="4" {...register("about")} />
          </label>
        </div>
        {mutation.isSuccess && <p className="success-message" role="status">Profile saved.</p>}
        {mutation.error && <ErrorState error={mutation.error} fallback="Could not save your profile." />}
        <button className="button button-primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save profile"}
        </button>
      </form>
    </section>
  );
}
