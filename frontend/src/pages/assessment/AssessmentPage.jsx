import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ErrorState, LoadingState } from "../../components/common/QueryState.jsx";
import { apiRequest } from "../../services/api.js";

const assessmentSchema = z.object({
  age: z.coerce.number().int().min(10).max(70),
  height_cm: z.coerce.number().positive().max(300),
  weight_kg: z.coerce.number().positive().max(500),
  cycle_regularity: z.enum(["regular", "irregular"]),
  avg_cycle_length_days: z.union([z.literal(""), z.coerce.number().int().min(1).max(365)]),
  excessive_hair_growth: z.boolean(),
  acne: z.boolean(),
  hair_thinning: z.boolean(),
  skin_darkening: z.boolean(),
  weight_gain_difficulty: z.boolean(),
  family_history_pcos: z.boolean(),
  mood_swings: z.boolean(),
});

const symptomFields = [
  ["excessive_hair_growth", "Excessive hair growth"],
  ["acne", "Persistent acne"],
  ["hair_thinning", "Hair thinning or hair fall"],
  ["skin_darkening", "Skin darkening (neck/underarms)"],
  ["weight_gain_difficulty", "Difficulty losing weight"],
  ["family_history_pcos", "Family history of PCOS"],
  ["mood_swings", "Frequent mood swings"],
];

export default function AssessmentPage() {
  const queryClient = useQueryClient();
  const [result, setResult] = useState(null);
  const profileQuery = useQuery({
    queryKey: ["assessment-history"],
    queryFn: () => apiRequest("/assessments/history"),
  });
  const mutation = useMutation({
    mutationFn: (values) =>
      apiRequest("/assessments", {
        method: "POST",
        data: {
          ...values,
          avg_cycle_length_days:
            values.avg_cycle_length_days === "" ? null : values.avg_cycle_length_days,
        },
      }),
    onSuccess: async (response) => {
      setResult(response);
      await queryClient.invalidateQueries({ queryKey: ["patient-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["assessment-history"] });
    },
  });
  const profile = profileQuery.data?.[0]?.profile;
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(assessmentSchema),
    values: {
      age: profile?.age ?? "",
      height_cm: profile?.height_cm ?? "",
      weight_kg: profile?.weight_kg ?? "",
      cycle_regularity: profile?.cycle_regularity ?? "regular",
      avg_cycle_length_days: profile?.avg_cycle_length_days ?? "",
      excessive_hair_growth: profile?.excessive_hair_growth ?? false,
      acne: profile?.acne ?? false,
      hair_thinning: profile?.hair_thinning ?? false,
      skin_darkening: profile?.skin_darkening ?? false,
      weight_gain_difficulty: profile?.weight_gain_difficulty ?? false,
      family_history_pcos: profile?.family_history_pcos ?? false,
      mood_swings: profile?.mood_swings ?? false,
    },
  });

  if (profileQuery.isLoading) return <LoadingState label="Loading your saved assessment..." />;
  if (profileQuery.error) {
    return <ErrorState error={profileQuery.error} fallback="Could not load your assessment." />;
  }

  return (
    <section className="content-page">
      <div className="page-heading">
        <span className="eyebrow">Health assessment</span>
        <h1>PCOS screening</h1>
        <p>This self-reported screening indicator is not a medical diagnosis.</p>
      </div>
      <form className="form-card" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <div className="form-grid">
          <label className="form-field">Age
            <input type="number" min="10" max="70" {...register("age")} />
            {errors.age && <span className="field-error">Enter an age from 10 to 70.</span>}
          </label>
          <label className="form-field">Height (cm)
            <input type="number" step="0.1" {...register("height_cm")} />
            {errors.height_cm && <span className="field-error">Enter a valid height.</span>}
          </label>
          <label className="form-field">Weight (kg)
            <input type="number" step="0.1" {...register("weight_kg")} />
            {errors.weight_kg && <span className="field-error">Enter a valid weight.</span>}
          </label>
          <label className="form-field">Menstrual cycle
            <select {...register("cycle_regularity")}>
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
            </select>
          </label>
          <label className="form-field">Average cycle length (days)
            <input type="number" {...register("avg_cycle_length_days")} />
            {errors.avg_cycle_length_days && <span className="field-error">Enter a value from 1 to 365.</span>}
          </label>
        </div>
        <fieldset className="symptom-fieldset">
          <legend>Symptoms you experience</legend>
          <div className="checkbox-grid">
            {symptomFields.map(([name, label]) => (
              <label className="checkbox-field" key={name}>
                <input type="checkbox" {...register(name)} /> {label}
              </label>
            ))}
          </div>
        </fieldset>
        {mutation.error && (
          <ErrorState error={mutation.error} fallback="Could not save your assessment." />
        )}
        <button className="button button-primary" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : "Save and view result"}
        </button>
      </form>
      {result && (
        <article className={`result-panel risk-panel--${result.result.risk_level.toLowerCase()}`}>
          <span className="eyebrow">Screening result</span>
          <h2>{result.result.risk_level} screening indicators</h2>
          <p>Score: {result.result.score}/{result.result.max_score} · BMI: {result.result.bmi}</p>
          <p>{result.result.message}</p>
          <p className="medical-disclaimer">
            Screening only; this is not a diagnosis. Consult a gynecologist for clinical evaluation.
          </p>
        </article>
      )}
    </section>
  );
}
