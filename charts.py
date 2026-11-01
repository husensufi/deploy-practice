"""
charts.py
---------
Generates the visual charts shown on the Reports page, using
matplotlib + seaborn — the standard, interview-defensible choice for
a Python data-visualization module (as opposed to a JS charting
library, which wouldn't fit your "everything in Python" requirement).

Why base64, not saved image files?
Each chart is drawn into memory (a BytesIO buffer) and converted to a
base64 string, which we embed directly into the HTML as
    <img src="data:image/png;base64,....">
This means we never litter your disk with hundreds of old PNG files —
every chart is generated fresh, on demand, from the current database.
"""

import matplotlib
matplotlib.use("Agg")  # no GUI needed — we're a web server, not a desktop app
import matplotlib.pyplot as plt
import seaborn as sns
import io
import base64

sns.set_theme(style="whitegrid")

# Match the app's color palette from style.css
PLUM = "#3F1B3D"
ROSE = "#D6667A"
TEAL = "#2F7A6B"


def _fig_to_base64(fig) -> str:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", dpi=140)
    plt.close(fig)
    buffer.seek(0)
    encoded = base64.b64encode(buffer.read()).decode("utf-8")
    return f"data:image/png;base64,{encoded}"


def _fig_to_bytes(fig) -> io.BytesIO:
    buffer = io.BytesIO()
    fig.savefig(buffer, format="png", bbox_inches="tight", dpi=140)
    plt.close(fig)
    buffer.seek(0)
    return buffer


def _build_cramp_pain_fig(logs):
    logs_sorted = list(reversed(logs))
    dates = [log.log_date.strftime("%d %b") for log in logs_sorted]
    pain = [log.cramp_pain_level for log in logs_sorted]

    fig, ax = plt.subplots(figsize=(7, 3.2))
    ax.plot(dates, pain, marker="o", color=ROSE, linewidth=2)
    ax.set_ylim(0, 10)
    ax.set_ylabel("Cramp Pain (0-10)")
    ax.set_title("Cramp Pain Trend", color=PLUM, fontsize=13, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=8)
    fig.tight_layout()
    return fig


def _build_sleep_exercise_fig(logs):
    logs_sorted = list(reversed(logs))
    dates = [log.log_date.strftime("%d %b") for log in logs_sorted]
    sleep = [log.sleep_hours for log in logs_sorted]
    exercise = [log.exercise_minutes for log in logs_sorted]

    fig, ax1 = plt.subplots(figsize=(7, 3.2))
    ax1.plot(dates, sleep, marker="o", color=TEAL, label="Sleep (hrs)", linewidth=2)
    ax1.set_ylabel("Sleep (hrs)", color=TEAL)

    ax2 = ax1.twinx()
    ax2.plot(dates, exercise, marker="s", color=PLUM, label="Exercise (min)", linewidth=2, linestyle="--")
    ax2.set_ylabel("Exercise (min)", color=PLUM)

    ax1.set_title("Sleep vs Exercise", color=PLUM, fontsize=13, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=8)
    fig.tight_layout()
    return fig


def _build_mood_fig(logs):
    mood_counts = {}
    for log in logs:
        mood_counts[log.mood] = mood_counts.get(log.mood, 0) + 1

    fig, ax = plt.subplots(figsize=(5.5, 3.2))
    if mood_counts:
        sns.barplot(
            x=list(mood_counts.keys()),
            y=list(mood_counts.values()),
            ax=ax,
            color=ROSE,
        )
    ax.set_ylabel("Days")
    ax.set_title("Mood Distribution", color=PLUM, fontsize=13, fontweight="bold")
    fig.tight_layout()
    return fig


def _build_water_fig(logs):
    logs_sorted = list(reversed(logs))
    dates = [log.log_date.strftime("%d %b") for log in logs_sorted]
    water = [log.water_intake_liters for log in logs_sorted]

    fig, ax = plt.subplots(figsize=(7, 3.0))
    ax.bar(dates, water, color=TEAL)
    ax.set_ylabel("Water (L)")
    ax.set_title("Water Intake", color=PLUM, fontsize=13, fontweight="bold")
    plt.xticks(rotation=45, ha="right", fontsize=8)
    fig.tight_layout()
    return fig


def cramp_pain_trend_chart(logs) -> str:
    return _fig_to_base64(_build_cramp_pain_fig(logs))


def sleep_exercise_chart(logs) -> str:
    return _fig_to_base64(_build_sleep_exercise_fig(logs))


def mood_distribution_chart(logs) -> str:
    return _fig_to_base64(_build_mood_fig(logs))


def water_intake_chart(logs) -> str:
    return _fig_to_base64(_build_water_fig(logs))


def generate_all_charts(logs) -> dict:
    """Returns a dict of chart_name -> base64 image string, for the web page."""
    if not logs:
        return {}
    return {
        "cramp_pain": cramp_pain_trend_chart(logs),
        "sleep_exercise": sleep_exercise_chart(logs),
        "mood": mood_distribution_chart(logs),
        "water": water_intake_chart(logs),
    }


def generate_all_charts_bytes(logs) -> dict:
    """Returns a dict of chart_name -> BytesIO PNG, for embedding in the PDF report."""
    if not logs:
        return {}
    return {
        "cramp_pain": _fig_to_bytes(_build_cramp_pain_fig(logs)),
        "sleep_exercise": _fig_to_bytes(_build_sleep_exercise_fig(logs)),
        "mood": _fig_to_bytes(_build_mood_fig(logs)),
        "water": _fig_to_bytes(_build_water_fig(logs)),
    }
