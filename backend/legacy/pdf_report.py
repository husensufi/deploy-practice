"""
pdf_report.py
-------------
Builds the printable "Doctor Report" PDF using reportlab — a real PDF,
not an HTML-to-PDF hack, so it prints cleanly and looks professional.

This is the file a patient can hand (or email) to her gynecologist:
her profile, her screening result, and her last 30 days of tracked
habits, in one document.
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from .charts import generate_all_charts_bytes

PLUM = colors.HexColor("#3F1B3D")
ROSE = colors.HexColor("#D6667A")
IVORY = colors.HexColor("#FBF5F2")


def build_pdf_report(user, profile, result, logs) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=18 * mm,
        leftMargin=18 * mm, rightMargin=18 * mm,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "TitleStyle", parent=styles["Title"], textColor=PLUM, fontSize=20, spaceAfter=4
    )
    heading_style = ParagraphStyle(
        "HeadingStyle", parent=styles["Heading2"], textColor=PLUM, spaceBefore=16, spaceAfter=8
    )
    normal = styles["Normal"]
    small_grey = ParagraphStyle("small_grey", parent=normal, textColor=colors.HexColor("#6E5F6C"), fontSize=9)

    elements = []

    # ---- Header ----
    elements.append(Paragraph("Ashwini Asangi PCOS GynoCare", title_style))
    elements.append(Paragraph("PCOS Screening &amp; Habit Report", styles["Heading3"]))
    elements.append(Paragraph(
        f"Generated on {datetime.now().strftime('%d %B %Y, %I:%M %p')}", small_grey
    ))
    elements.append(Spacer(1, 12))

    # ---- Patient details ----
    elements.append(Paragraph("Patient Details", heading_style))
    patient_data = [
        ["Name", user.full_name],
        ["Email", user.email],
        ["Mobile", user.mobile or "-"],
    ]
    if profile:
        patient_data += [
            ["Age", str(profile.age)],
            ["Height", f"{profile.height_cm} cm"],
            ["Weight", f"{profile.weight_kg} kg"],
            ["Cycle Regularity", profile.cycle_regularity.title()],
        ]
    table = Table(patient_data, colWidths=[130, 320])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TEXTCOLOR", (0, 0), (0, -1), PLUM),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#ECE0E2")),
    ]))
    elements.append(table)

    # ---- Screening result ----
    if result:
        elements.append(Paragraph("Screening Result", heading_style))
        result_data = [
            ["Risk Level", result.risk_level],
            ["Score", f"{result.score} / {result.max_score}"],
            ["BMI", str(result.bmi)],
        ]
        rtable = Table(result_data, colWidths=[130, 320])
        rtable.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F3D9DD")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
        ]))
        elements.append(rtable)
        elements.append(Spacer(1, 6))
        elements.append(Paragraph(result.message, normal))
        elements.append(Spacer(1, 4))
        elements.append(Paragraph(
            "<i>This is a self-reported screening indicator, not a medical "
            "diagnosis. Clinical confirmation requires blood hormone tests "
            "and pelvic ultrasound by a gynecologist.</i>", small_grey
        ))

        # ---- Symptom checklist ----
        if profile:
            elements.append(Paragraph("Reported Symptoms", heading_style))
            symptoms = [
                ("Excessive hair growth", profile.excessive_hair_growth),
                ("Persistent acne", profile.acne),
                ("Hair thinning", profile.hair_thinning),
                ("Skin darkening", profile.skin_darkening),
                ("Difficulty losing weight", profile.weight_gain_difficulty),
                ("Family history of PCOS", profile.family_history_pcos),
                ("Frequent mood swings", profile.mood_swings),
            ]
            sym_data = [[name, "Yes" if val else "No"] for name, val in symptoms]
            stable = Table(sym_data, colWidths=[300, 150])
            stable.setStyle(TableStyle([
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, colors.HexColor("#ECE0E2")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]))
            elements.append(stable)

    # ---- Charts ----
    if logs:
        elements.append(PageBreak())
        elements.append(Paragraph("Habit Tracking Charts (Recent Entries)", heading_style))
        chart_bytes = generate_all_charts_bytes(logs)
        for key in ["cramp_pain", "sleep_exercise", "water", "mood"]:
            if key in chart_bytes:
                elements.append(Image(chart_bytes[key], width=460, height=200))
                elements.append(Spacer(1, 10))

        # ---- Raw log table ----
        elements.append(PageBreak())
        elements.append(Paragraph("Daily Log Entries", heading_style))
        log_header = ["Date", "Period", "Cramp", "Water(L)", "Exercise(min)", "Sleep(hr)", "Mood"]
        log_rows = [log_header]
        for log in logs:
            log_rows.append([
                str(log.log_date),
                "Yes" if log.on_period else "No",
                str(log.cramp_pain_level),
                str(log.water_intake_liters),
                str(log.exercise_minutes),
                str(log.sleep_hours),
                log.mood.title(),
            ])
        ltable = Table(log_rows, repeatRows=1)
        ltable.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), PLUM),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#ECE0E2")),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, IVORY]),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
        ]))
        elements.append(ltable)
    else:
        elements.append(Spacer(1, 10))
        elements.append(Paragraph("No daily tracker entries yet.", normal))

    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
