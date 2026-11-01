"""
train_model.py
--------------
Trains a real machine-learning model to predict PCOS from the same
symptoms your app collects, and saves it so the website can use it.

HOW TO RUN (in the VS Code terminal, venv active):
    python -m backend.legacy.train_model path\\to\\your_dataset.csv
(.xlsx files also work.)

DATASET (you must download it yourself — I cannot download it for you):
    Kaggle -> "Polycystic Ovary Syndrome (PCOS)" by Prasoon Kottarathil.
    About 541 patients from 10 hospitals in Kerala, India, each labelled
    PCOS yes/no. Download it from kaggle.com (free account) and cite it
    in your report. Check the dataset page for its current licence.

WHAT THE SCRIPT DOES (explain this in your viva):
    1. Loads the data and picks the columns that match your app's form.
    2. Splits it 80% training / 20% testing (stratified, so both parts
       keep the same PCOS/non-PCOS ratio).
    3. Trains two models: Logistic Regression and Random Forest.
    4. Checks each with 5-fold cross-validation on the training part.
    5. Evaluates the better one on the untouched 20% test part and
       prints accuracy, precision, recall, F1 and ROC-AUC.
    6. Saves the model, report, and confusion-matrix chart under
       backend/models/.

IMPORTANT HONESTY NOTES:
    * Use the numbers THIS script prints on YOUR computer in your report.
      Never quote numbers from anywhere else.
    * The dataset comes from one region and a few hospitals, so results
      may not generalise to every population. State this as a limitation.
    * The app's form asks self-reported symptoms only; the dataset also
      has lab values we deliberately do NOT use, because a patient using
      the website will not have them.
"""

import sys
import re
from pathlib import Path
import joblib
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, roc_auc_score, confusion_matrix,
                             ConfusionMatrixDisplay)

# The model's input features — order matters and must match detection.py
FEATURES = ["age", "bmi", "cycle_irregular", "weight_gain",
            "hair_growth", "skin_darkening", "hair_loss", "pimples"]
MODEL_OUTPUT_DIR = Path(__file__).resolve().parents[1] / "models"


def norm(name: str) -> str:
    """'Hair growth(Y/N)' -> 'hairgrowthyn' so column names match loosely."""
    return re.sub(r"[^a-z0-9]", "", str(name).lower())


def find_col(df, key):
    for c in df.columns:
        if norm(c).startswith(key):
            return c
    return None


def to_binary(series):
    if series.dtype == object:
        return series.astype(str).str.strip().str.upper().isin(["Y", "YES", "1", "TRUE"]).astype(int)
    return (pd.to_numeric(series, errors="coerce").fillna(0) > 0).astype(int)


def load_dataset(path):
    if path.lower().endswith((".xlsx", ".xls")):
        sheets = pd.read_excel(path, sheet_name=None)
        df = None
        for _, s in sheets.items():
            if find_col(s, "pcos") is not None:
                df = s
                break
        if df is None:
            sys.exit("Could not find a sheet containing a PCOS column.")
    else:
        df = pd.read_csv(path)
    return df


def build_table(df):
    needed = {
        "target": "pcos", "age": "age", "bmi": "bmi", "cycle": "cycleri",
        "weight_gain": "weightgain", "hair_growth": "hairgrowth",
        "skin_darkening": "skindarkening", "hair_loss": "hairloss",
        "pimples": "pimples",
    }
    cols = {k: find_col(df, v) for k, v in needed.items()}
    missing = [k for k, v in cols.items() if v is None]
    if missing:
        print("Columns found in your file:\n", list(df.columns))
        sys.exit(f"Could not match these columns: {missing}. "
                 "Tell your guide/me the column list above so the names can be mapped.")

    out = pd.DataFrame()
    out["age"] = pd.to_numeric(df[cols["age"]], errors="coerce")
    out["bmi"] = pd.to_numeric(df[cols["bmi"]], errors="coerce")

    cyc = df[cols["cycle"]]
    print("\nCycle column values (check which means irregular):")
    print(cyc.value_counts(dropna=False).to_string())
    if cyc.dtype == object:
        out["cycle_irregular"] = cyc.astype(str).str.strip().str.upper().eq("I").astype(int)
    else:
        # In the Kaggle file: 2 = regular, 4 = irregular. VERIFY with the counts above.
        out["cycle_irregular"] = (pd.to_numeric(cyc, errors="coerce") == 4).astype(int)

    out["weight_gain"] = to_binary(df[cols["weight_gain"]])
    out["hair_growth"] = to_binary(df[cols["hair_growth"]])
    out["skin_darkening"] = to_binary(df[cols["skin_darkening"]])
    out["hair_loss"] = to_binary(df[cols["hair_loss"]])
    out["pimples"] = to_binary(df[cols["pimples"]])
    y = to_binary(df[cols["target"]])
    return out[FEATURES], y


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python -m backend.legacy.train_model path\\to\\dataset.csv")
    MODEL_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset(sys.argv[1])
    X, y = build_table(df)
    print(f"\nRows: {len(X)} | PCOS positive: {int(y.sum())} | negative: {int((1 - y).sum())}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y)

    candidates = {
        "Logistic Regression": Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, class_weight="balanced"))]),
        "Random Forest": Pipeline([
            ("impute", SimpleImputer(strategy="median")),
            ("clf", RandomForestClassifier(n_estimators=300, random_state=42,
                                           class_weight="balanced"))]),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    lines, best_name, best_cv = [], None, -1
    for name, pipe in candidates.items():
        scores = cross_val_score(pipe, X_train, y_train, cv=cv, scoring="roc_auc")
        lines.append(f"{name}: 5-fold CV ROC-AUC = {scores.mean():.3f} (+/- {scores.std():.3f})")
        if scores.mean() > best_cv:
            best_cv, best_name = scores.mean(), name

    best = candidates[best_name]
    best.fit(X_train, y_train)
    pred = best.predict(X_test)
    prob = best.predict_proba(X_test)[:, 1]

    lines += [
        "", f"Selected model: {best_name}", "Test-set results (20% unseen data):",
        f"  Accuracy : {accuracy_score(y_test, pred):.3f}",
        f"  Precision: {precision_score(y_test, pred):.3f}",
        f"  Recall   : {recall_score(y_test, pred):.3f}",
        f"  F1-score : {f1_score(y_test, pred):.3f}",
        f"  ROC-AUC  : {roc_auc_score(y_test, prob):.3f}",
        f"  Confusion matrix [[TN, FP], [FN, TP]]: {confusion_matrix(y_test, pred).tolist()}",
    ]
    report = "\n".join(lines)
    print("\n" + report)

    ConfusionMatrixDisplay.from_predictions(y_test, pred, cmap="RdPu")
    plt.title(f"Confusion Matrix - {best_name}")
    plt.savefig(MODEL_OUTPUT_DIR / "confusion_matrix.png", dpi=140, bbox_inches="tight")

    joblib.dump(
        {"model": best, "features": FEATURES, "name": best_name},
        MODEL_OUTPUT_DIR / "pcos_model.joblib",
    )
    with open(MODEL_OUTPUT_DIR / "training_report.txt", "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\nSaved model outputs in {MODEL_OUTPUT_DIR}")
    print("Restart the website; the result page will now show the ML estimate too.")


if __name__ == "__main__":
    main()
