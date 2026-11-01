"""
detection.py
------------
This is your "detection engine" for Part 2 — a transparent, RULE-BASED
screening score. It is intentionally simple and explainable right now
because that is what you need for a working system you can defend in
an interview: you can point to every single point in the score and say
exactly why it's there, and cite the clinical basis for each factor.

In Part 3 (or a later paper), you can REPLACE or SUPPLEMENT this with a
trained ML/CNN model, and compare the two — "rule-based baseline vs.
learned model" is itself a nice structure for a research paper.

WHAT THIS IS NOT:
This is a self-reported SCREENING indicator, not a medical diagnosis.
Real PCOS diagnosis clinically uses the Rotterdam criteria (irregular
ovulation + hyperandrogenism + polycystic ovaries on ultrasound — any
2 of 3). We are approximating the first two with self-reported symptoms.
Always show the disclaimer in the UI — never remove it.

Scoring rationale (each factor is a symptom associated with PCOS in
clinical literature; weights reflect how strongly each is associated):
    irregular cycle            -> 2 points  (core diagnostic criterion)
    excessive hair growth      -> 2 points  (hyperandrogenism sign)
    acne                       -> 1 point   (hyperandrogenism sign)
    hair thinning              -> 1 point   (androgenic alopecia)
    skin darkening              -> 1 point   (insulin resistance marker)
    difficulty losing weight   -> 1 point   (metabolic symptom)
    family history of PCOS      -> 1 point   (genetic risk factor)
    mood swings                 -> 1 point   (commonly co-reported)
    BMI >= 25 (overweight)      -> 1 point   (associated risk factor)

    Maximum possible score: 11
"""

from dataclasses import dataclass


@dataclass
class ScreeningResult:
    score: int
    max_score: int
    risk_level: str        # "Low" | "Moderate" | "High"
    bmi: float
    message: str
    ml_probability: float = None   # filled only if a trained model exists


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    height_m = height_cm / 100
    return round(weight_kg / (height_m ** 2), 1)


def ml_estimate(profile):
    """
    Returns the trained ML model's PCOS probability (0-1), or None if no
    model has been trained yet (run train_model.py to create one).
    Any problem here must never break the website, hence the try/except.
    """
    try:
        import os
        import joblib
        import pandas as pd
        path = os.path.join("models", "pcos_model.joblib")
        if not os.path.exists(path):
            return None
        bundle = joblib.load(path)
        bmi = calculate_bmi(profile.weight_kg, profile.height_cm)
        row = [[
            profile.age, bmi,
            1 if profile.cycle_regularity == "irregular" else 0,
            int(bool(profile.weight_gain_difficulty)),
            int(bool(profile.excessive_hair_growth)),
            int(bool(profile.skin_darkening)),
            int(bool(profile.hair_thinning)),
            int(bool(profile.acne)),
        ]]
        frame = pd.DataFrame(row, columns=bundle["features"])
        return float(bundle["model"].predict_proba(frame)[0][1])
    except Exception:
        return None


def run_pcos_screening(profile) -> ScreeningResult:
    """
    profile: a PCOSProfile database object (see models_tracker.py)
    Returns a ScreeningResult with a transparent, explainable score.
    """
    score = 0

    if profile.cycle_regularity == "irregular":
        score += 2
    if profile.excessive_hair_growth:
        score += 2
    if profile.acne:
        score += 1
    if profile.hair_thinning:
        score += 1
    if profile.skin_darkening:
        score += 1
    if profile.weight_gain_difficulty:
        score += 1
    if profile.family_history_pcos:
        score += 1
    if profile.mood_swings:
        score += 1

    bmi = calculate_bmi(profile.weight_kg, profile.height_cm)
    if bmi >= 25:
        score += 1

    max_score = 11

    if score >= 6:
        risk_level = "High"
        message = (
            "Several PCOS-associated indicators are present. This is a "
            "screening result, not a diagnosis — please consult a "
            "gynecologist for clinical evaluation (blood tests and "
            "ultrasound)."
        )
    elif score >= 3:
        risk_level = "Moderate"
        message = (
            "Some PCOS-associated indicators are present. Keep tracking "
            "your daily symptoms and consider discussing this with a "
            "doctor at your next visit."
        )
    else:
        risk_level = "Low"
        message = (
            "Few PCOS-associated indicators are present based on your "
            "answers. Continue tracking your cycle and habits regularly."
        )

    return ScreeningResult(
        score=score,
        max_score=max_score,
        risk_level=risk_level,
        bmi=bmi,
        message=message,
        ml_probability=ml_estimate(profile),
    )
