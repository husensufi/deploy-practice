"""
main.py
-------
This is the file you actually RUN. It starts the web server and
defines every URL ("route") your website responds to.

HOW TO RUN (do this in VS Code's terminal, inside this folder):
    uvicorn main:app --reload

Then open your browser at:  http://127.0.0.1:8000

Routes in this Part 1:
    GET  /                -> redirects to /login
    GET  /login            -> shows the login page
    POST /login            -> processes login form
    GET  /signup           -> shows the signup page
    POST /signup           -> creates a new account
    GET  /logout           -> logs the user out
    GET  /home              -> the protected welcome page (after login)
    GET  /api/translations/{lang} -> returns text in en/hi/kn as JSON

Routes added in Part 2:
    GET  /assessment        -> show the PCOS clinical profile form
    POST /assessment        -> save profile + show screening result
    GET  /assessment/result -> re-show the last screening result
    GET  /tracker            -> show today's daily-log form + history
    POST /tracker            -> save a daily log entry
"""

from fastapi import FastAPI, Request, Depends, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from datetime import date
import json
import os

from database import engine, Base, get_db, SessionLocal
from models import User
from models_tracker import PCOSProfile, DailyLog
from models_doctor import DoctorProfile
from models_social import Connection, ChatMessage
from auth import hash_password, verify_password, create_access_token, decode_access_token
from detection import run_pcos_screening
from charts import generate_all_charts
from pdf_report import build_pdf_report
from chatbot import get_ai_reply
from pydantic import BaseModel

# ---- Create all database tables the first time the app runs ----
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Ashwini Asangi PCOS GynoCare")

# ---- Serve static files (css, js, images) ----
app.mount("/static", StaticFiles(directory="static"), name="static")

# ---- Templates (HTML pages) ----
templates = Jinja2Templates(directory="templates")


# =========================================================
# Helper: figure out who is logged in from the cookie
# =========================================================
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    return user


# =========================================================
# Root -> send people to login
# =========================================================
@app.get("/")
def root():
    return RedirectResponse(url="/login")


# =========================================================
# LOGIN
# =========================================================
@app.get("/login")
def login_page(request: Request):
    return templates.TemplateResponse(
        "login.html", {"request": request, "error": None}
    )


@app.post("/login")
def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(password, user.hashed_password):
        # Wrong email or password -> show the form again with an error
        return templates.TemplateResponse(
            "login.html",
            {"request": request, "error": "Invalid email or password."},
        )

    token = create_access_token({"sub": user.email})
    response = RedirectResponse(url="/home", status_code=303)
    # httponly=True means JavaScript cannot read this cookie -> safer
    response.set_cookie(key="access_token", value=token, httponly=True, max_age=60 * 60 * 24 * 7)
    return response


# =========================================================
# SIGNUP
# =========================================================
@app.get("/signup")
def signup_page(request: Request):
    return templates.TemplateResponse(
        "signup.html", {"request": request, "error": None}
    )


@app.post("/signup")
def signup_submit(
    request: Request,
    full_name: str = Form(...),
    email: str = Form(...),
    mobile: str = Form(...),
    password: str = Form(...),
    confirm_password: str = Form(...),
    role: str = Form("patient"),
    db: Session = Depends(get_db),
):
    # ---- basic validation ----
    if password != confirm_password:
        return templates.TemplateResponse(
            "signup.html", {"request": request, "error": "Passwords do not match."}
        )

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return templates.TemplateResponse(
            "signup.html", {"request": request, "error": "An account with this email already exists."}
        )

    new_user = User(
        full_name=full_name,
        email=email,
        mobile=mobile,
        hashed_password=hash_password(password),
        role=role,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Auto-login right after signup
    token = create_access_token({"sub": new_user.email})
    response = RedirectResponse(url="/home", status_code=303)
    response.set_cookie(key="access_token", value=token, httponly=True, max_age=60 * 60 * 24 * 7)
    return response


# =========================================================
# LOGOUT
# =========================================================
@app.get("/logout")
def logout():
    response = RedirectResponse(url="/login")
    response.delete_cookie("access_token")
    return response


# =========================================================
# HOME (protected page — only for logged-in users)
# =========================================================
@app.get("/home")
def home_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse(
        "home.html", {"request": request, "user": user}
    )


# =========================================================
# TRANSLATIONS API
# This is what makes the whole site multilingual.
# The browser calls /api/translations/hi (or en / kn) and gets
# back a JSON dictionary of every text label in that language.
# =========================================================
@app.get("/api/translations/{lang}")
def get_translations(lang: str):
    allowed = {"en", "hi", "kn"}
    if lang not in allowed:
        lang = "en"
    file_path = os.path.join("static", "locales", f"{lang}.json")
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return JSONResponse(content=data)


# =========================================================
# PCOS CLINICAL PROFILE + SCREENING  (Part 2)
# =========================================================
@app.get("/assessment")
def assessment_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    existing_profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    return templates.TemplateResponse(
        "assessment.html",
        {"request": request, "user": user, "profile": existing_profile},
    )


@app.post("/assessment")
def assessment_submit(
    request: Request,
    age: int = Form(...),
    height_cm: float = Form(...),
    weight_kg: float = Form(...),
    cycle_regularity: str = Form(...),
    avg_cycle_length_days: int = Form(None),
    excessive_hair_growth: str = Form(None),
    acne: str = Form(None),
    hair_thinning: str = Form(None),
    skin_darkening: str = Form(None),
    weight_gain_difficulty: str = Form(None),
    family_history_pcos: str = Form(None),
    mood_swings: str = Form(None),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    # Checkboxes only appear in form data when checked, so "value present" = True
    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    if not profile:
        profile = PCOSProfile(user_id=user.id)
        db.add(profile)

    profile.age = age
    profile.height_cm = height_cm
    profile.weight_kg = weight_kg
    profile.cycle_regularity = cycle_regularity
    profile.avg_cycle_length_days = avg_cycle_length_days
    profile.excessive_hair_growth = bool(excessive_hair_growth)
    profile.acne = bool(acne)
    profile.hair_thinning = bool(hair_thinning)
    profile.skin_darkening = bool(skin_darkening)
    profile.weight_gain_difficulty = bool(weight_gain_difficulty)
    profile.family_history_pcos = bool(family_history_pcos)
    profile.mood_swings = bool(mood_swings)

    db.commit()
    db.refresh(profile)

    result = run_pcos_screening(profile)

    return templates.TemplateResponse(
        "assessment_result.html",
        {"request": request, "user": user, "profile": profile, "result": result},
    )


@app.get("/assessment/result")
def assessment_result_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    if not profile:
        return RedirectResponse(url="/assessment")

    result = run_pcos_screening(profile)
    return templates.TemplateResponse(
        "assessment_result.html",
        {"request": request, "user": user, "profile": profile, "result": result},
    )


# =========================================================
# DAILY TRACKER  (Part 2)
# =========================================================
@app.get("/tracker")
def tracker_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(14)
        .all()
    )
    today_log = db.query(DailyLog).filter(
        DailyLog.user_id == user.id, DailyLog.log_date == date.today()
    ).first()

    return templates.TemplateResponse(
        "tracker.html",
        {"request": request, "user": user, "logs": logs, "today_log": today_log, "today": date.today()},
    )


@app.post("/tracker")
def tracker_submit(
    request: Request,
    on_period: str = Form(None),
    cramp_pain_level: int = Form(0),
    water_intake_liters: float = Form(0.0),
    exercise_minutes: int = Form(0),
    sleep_hours: float = Form(0.0),
    mood: str = Form("normal"),
    junk_food: str = Form(None),
    notes: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    today = date.today()
    log = db.query(DailyLog).filter(
        DailyLog.user_id == user.id, DailyLog.log_date == today
    ).first()
    if not log:
        log = DailyLog(user_id=user.id, log_date=today)
        db.add(log)

    log.on_period = bool(on_period)
    log.cramp_pain_level = cramp_pain_level
    log.water_intake_liters = water_intake_liters
    log.exercise_minutes = exercise_minutes
    log.sleep_hours = sleep_hours
    log.mood = mood
    log.junk_food = bool(junk_food)
    log.notes = notes

    db.commit()
    return RedirectResponse(url="/tracker", status_code=303)


# =========================================================
# REPORTS  (Part 3) — charts + printable PDF
# =========================================================
@app.get("/reports")
def reports_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    result = run_pcos_screening(profile) if profile else None

    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(30)
        .all()
    )

    charts = generate_all_charts(logs)

    return templates.TemplateResponse(
        "reports.html",
        {
            "request": request, "user": user, "profile": profile,
            "result": result, "logs": logs, "charts": charts,
        },
    )


@app.get("/reports/pdf")
def download_pdf_report(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    profile = db.query(PCOSProfile).filter(PCOSProfile.user_id == user.id).first()
    result = run_pcos_screening(profile) if profile else None
    logs = (
        db.query(DailyLog)
        .filter(DailyLog.user_id == user.id)
        .order_by(DailyLog.log_date.desc())
        .limit(30)
        .all()
    )

    pdf_bytes = build_pdf_report(user, profile, result, logs)
    filename = f"PCOS_Report_{user.full_name.replace(' ', '_')}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =========================================================
# DOCTORS  (Part 4)
# =========================================================
@app.get("/doctors")
def doctors_directory(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    doctors = (
        db.query(DoctorProfile, User)
        .join(User, DoctorProfile.user_id == User.id)
        .all()
    )
    return templates.TemplateResponse(
        "doctors.html", {"request": request, "user": user, "doctors": doctors}
    )


@app.get("/doctor/profile")
def doctor_profile_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    if user.role != "doctor":
        return RedirectResponse(url="/home")

    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    return templates.TemplateResponse(
        "doctor_profile_form.html", {"request": request, "user": user, "profile": profile}
    )


@app.post("/doctor/profile")
def doctor_profile_submit(
    request: Request,
    clinic_name: str = Form(...),
    specialization: str = Form("Gynecologist"),
    city: str = Form(...),
    address: str = Form(...),
    phone: str = Form(...),
    consultation_hours: str = Form("Mon–Sat, 10 AM – 6 PM"),
    about: str = Form(""),
    photo_url: str = Form(""),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    if user.role != "doctor":
        return RedirectResponse(url="/home")

    profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not profile:
        profile = DoctorProfile(user_id=user.id)
        db.add(profile)

    profile.clinic_name = clinic_name
    profile.specialization = specialization
    profile.city = city
    profile.address = address
    profile.phone = phone
    profile.consultation_hours = consultation_hours
    profile.about = about
    profile.photo_url = photo_url or None

    db.commit()
    return RedirectResponse(url="/doctors", status_code=303)


# =========================================================
# FRIENDS & FAMILY — connections, chat, care alerts  (Part 5)
# =========================================================

class ConnectionManager:
    """Keeps track of who currently has a chat window open, so we can
    push new messages to them instantly without the page refreshing."""

    def __init__(self):
        self.active: dict[str, list[WebSocket]] = {}

    @staticmethod
    def room_key(user_a: int, user_b: int) -> str:
        return f"{min(user_a, user_b)}_{max(user_a, user_b)}"

    async def connect(self, websocket: WebSocket, room: str):
        await websocket.accept()
        self.active.setdefault(room, []).append(websocket)

    def disconnect(self, websocket: WebSocket, room: str):
        if room in self.active and websocket in self.active[room]:
            self.active[room].remove(websocket)

    async def broadcast(self, room: str, message: dict):
        for ws in list(self.active.get(room, [])):
            try:
                await ws.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.get("/connections")
def connections_page(request: Request, db: Session = Depends(get_db), error: str = None, success: str = None):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    accepted = (
        db.query(Connection, User)
        .join(User, User.id == Connection.receiver_id)
        .filter(Connection.requester_id == user.id, Connection.status == "accepted")
        .all()
    )
    accepted_reverse = (
        db.query(Connection, User)
        .join(User, User.id == Connection.requester_id)
        .filter(Connection.receiver_id == user.id, Connection.status == "accepted")
        .all()
    )
    all_accepted = accepted + accepted_reverse

    pending_incoming = (
        db.query(Connection, User)
        .join(User, User.id == Connection.requester_id)
        .filter(Connection.receiver_id == user.id, Connection.status == "pending")
        .all()
    )

    return templates.TemplateResponse(
        "connections.html",
        {
            "request": request, "user": user,
            "connections": all_accepted, "pending_incoming": pending_incoming,
            "error": error, "success": success,
        },
    )


@app.post("/connections/add")
def add_connection(
    request: Request,
    friend_email: str = Form(...),
    relationship_type: str = Form("friend"),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    friend_email_clean = friend_email.strip().lower()

    if friend_email_clean == user.email.strip().lower():
        return RedirectResponse(
            url="/connections?error=self", status_code=303
        )

    # Case-insensitive email lookup, since emails are usually not case-sensitive
    friend = db.query(User).filter(User.email.ilike(friend_email_clean)).first()
    if not friend:
        return RedirectResponse(
            url="/connections?error=not_found", status_code=303
        )

    existing = db.query(Connection).filter(
        ((Connection.requester_id == user.id) & (Connection.receiver_id == friend.id)) |
        ((Connection.requester_id == friend.id) & (Connection.receiver_id == user.id))
    ).first()
    if existing:
        return RedirectResponse(
            url="/connections?error=already_exists", status_code=303
        )

    conn = Connection(
        requester_id=user.id, receiver_id=friend.id,
        relationship_type=relationship_type, status="pending",
    )
    db.add(conn)
    db.commit()
    return RedirectResponse(url="/connections?success=request_sent", status_code=303)


@app.post("/connections/accept/{connection_id}")
def accept_connection(connection_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    conn = db.query(Connection).filter(
        Connection.id == connection_id, Connection.receiver_id == user.id
    ).first()
    if conn:
        conn.status = "accepted"
        db.commit()
    return RedirectResponse(url="/connections", status_code=303)


def _is_connected(db: Session, user_id: int, friend_id: int) -> bool:
    return db.query(Connection).filter(
        (
            ((Connection.requester_id == user_id) & (Connection.receiver_id == friend_id)) |
            ((Connection.requester_id == friend_id) & (Connection.receiver_id == user_id))
        ) & (Connection.status == "accepted")
    ).first() is not None


@app.get("/connections/{friend_id}/chat")
def chat_page(friend_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    friend = db.query(User).filter(User.id == friend_id).first()
    if not friend or not _is_connected(db, user.id, friend_id):
        return RedirectResponse(url="/connections")

    messages = (
        db.query(ChatMessage)
        .filter(
            ((ChatMessage.sender_id == user.id) & (ChatMessage.receiver_id == friend_id)) |
            ((ChatMessage.sender_id == friend_id) & (ChatMessage.receiver_id == user.id))
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )

    return templates.TemplateResponse(
        "chat.html",
        {"request": request, "user": user, "friend": friend, "messages": messages},
    )


@app.websocket("/ws/chat/{friend_id}")
async def chat_websocket(websocket: WebSocket, friend_id: int):
    token = websocket.cookies.get("access_token")
    payload = decode_access_token(token) if token else None
    if not payload:
        await websocket.close(code=1008)
        return

    db = SessionLocal()
    user = db.query(User).filter(User.email == payload.get("sub")).first()
    if not user or not _is_connected(db, user.id, friend_id):
        await websocket.close(code=1008)
        db.close()
        return

    room = manager.room_key(user.id, friend_id)
    await manager.connect(websocket, room)
    try:
        while True:
            data = await websocket.receive_json()
            content = (data.get("content") or "").strip()
            if not content:
                continue
            msg = ChatMessage(
                sender_id=user.id, receiver_id=friend_id,
                content=content, message_type="text",
            )
            db.add(msg)
            db.commit()
            db.refresh(msg)
            await manager.broadcast(room, {
                "sender_id": user.id,
                "sender_name": user.full_name,
                "content": content,
                "time": msg.created_at.strftime("%I:%M %p"),
                "message_type": "text",
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, room)
    finally:
        db.close()


@app.post("/connections/{friend_id}/notify")
async def send_care_alert(friend_id: int, request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    if not _is_connected(db, user.id, friend_id):
        return RedirectResponse(url="/connections")

    today_log = db.query(DailyLog).filter(
        DailyLog.user_id == user.id, DailyLog.log_date == date.today()
    ).first()

    if today_log and today_log.on_period and today_log.cramp_pain_level >= 6:
        text = (
            f"💗 {user.full_name} is on her period today with strong cramp pain "
            f"({today_log.cramp_pain_level}/10). She could use some extra care right now."
        )
    elif today_log and today_log.mood in ("irritated", "sad", "anxious"):
        text = (
            f"💗 {user.full_name} is feeling {today_log.mood} today and wanted you to know. "
            f"A little extra kindness would go a long way right now."
        )
    else:
        text = f"💗 {user.full_name} wanted to let you know she could use some care and attention today."

    msg = ChatMessage(sender_id=user.id, receiver_id=friend_id, content=text, message_type="care_alert")
    db.add(msg)
    db.commit()
    db.refresh(msg)

    room = manager.room_key(user.id, friend_id)
    await manager.broadcast(room, {
        "sender_id": user.id,
        "sender_name": user.full_name,
        "content": text,
        "time": msg.created_at.strftime("%I:%M %p"),
        "message_type": "care_alert",
    })

    return RedirectResponse(url=f"/connections/{friend_id}/chat", status_code=303)


# =========================================================
# AI CHATBOT — GynoBuddy  (Part 6)
# =========================================================
@app.get("/chatbot")
def chatbot_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("chatbot.html", {"request": request, "user": user})


class ChatbotRequest(BaseModel):
    history: list  # [{"role": "user"/"assistant", "content": "..."}]


@app.post("/api/chatbot")
def chatbot_api(request: Request, body: ChatbotRequest, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return JSONResponse(status_code=401, content={"reply": "Please log in again."})

    reply = get_ai_reply(body.history)
    return JSONResponse(content={"reply": reply})


# =========================================================
# GAMES  (Part 6)
# =========================================================
@app.get("/games")
def games_hub(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")

    accepted = (
        db.query(Connection, User)
        .join(User, User.id == Connection.receiver_id)
        .filter(Connection.requester_id == user.id, Connection.status == "accepted")
        .all()
    )
    accepted_reverse = (
        db.query(Connection, User)
        .join(User, User.id == Connection.requester_id)
        .filter(Connection.receiver_id == user.id, Connection.status == "accepted")
        .all()
    )
    friends = accepted + accepted_reverse

    return templates.TemplateResponse(
        "games.html", {"request": request, "user": user, "friends": friends}
    )


@app.get("/games/bubbles")
def game_bubbles(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("game_bubbles.html", {"request": request, "user": user})


@app.get("/games/runner")
def game_runner(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("game_runner.html", {"request": request, "user": user})


@app.get("/games/match")
def game_match(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("game_match.html", {"request": request, "user": user})


@app.get("/games/craving")
def game_craving(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("game_craving.html", {"request": request, "user": user})


@app.post("/games/invite")
def invite_to_game(
    request: Request,
    friend_id: int = Form(...),
    game_name: str = Form(...),
    db: Session = Depends(get_db),
):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    if not _is_connected(db, user.id, friend_id):
        return RedirectResponse(url="/games")

    text = f"🎮 {user.full_name} invites you to play \"{game_name}\"! Open Games from the menu to join in."
    msg = ChatMessage(sender_id=user.id, receiver_id=friend_id, content=text, message_type="text")
    db.add(msg)
    db.commit()
    return RedirectResponse(url=f"/connections/{friend_id}/chat", status_code=303)


# =========================================================
# YOGA & EXERCISE  (Part 7)
# =========================================================
@app.get("/yoga")
def yoga_page(request: Request, db: Session = Depends(get_db)):
    user = get_current_user(request, db)
    if not user:
        return RedirectResponse(url="/login")
    return templates.TemplateResponse("yoga.html", {"request": request, "user": user})
