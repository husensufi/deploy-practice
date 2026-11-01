# Existing Workflows and Routes

This document records behavior found in the current application. It is the behavior-preservation baseline, not a claim that the proposed target API has already been implemented.

## User workflows

### Authentication

1. A visitor opens `/login` or `/signup`.
2. Signup validates that password and confirmation match and checks for an existing email; it hashes the password and creates a `User`.
3. Successful login verifies the password hash.
4. Signup and login set an `httpOnly` `access_token` JWT cookie and redirect to `/home`.
5. Protected page handlers decode the cookie and look up the user; missing/invalid authentication redirects to `/login`.
6. `/logout` deletes the cookie and redirects to `/login`.

Signup accepts patient or doctor role. The shared home navigation conditionally shows the clinic-profile link for doctors, but most application pages are not role-specific.

### PCOS assessment

1. `/assessment` loads the current user's single `PCOSProfile` if one exists.
2. The form collects age, height, weight, menstrual-cycle regularity, average cycle length, and seven symptom flags.
3. `POST /assessment` creates or updates the one-to-one profile.
4. `detection.run_pcos_screening` calculates BMI and the unchanged rule-based score, then renders a result with Low/Moderate/High screening wording.
5. `/assessment/result` re-computes the result from the saved profile.

The screening template explicitly states that the result is not a diagnosis. There is no separate assessment-history table or route; subsequent submissions replace fields in the current profile.

### Daily tracker

1. `/tracker` shows today's saved log and up to 14 recent logs for the current user.
2. `POST /tracker` creates or updates one `DailyLog` for today's date.
3. Fields are period status, cramp level (0-10), water intake, exercise minutes, sleep hours, mood, junk-food flag, and notes.

The present route does not implement delete or arbitrary-date create/update operations. Do not promise those as existing behavior.

### Reports

- `/reports` loads the user's profile and up to 30 most recent logs, computes the current screening result when a profile exists, and generates four charts when logs exist.
- `/reports/pdf` uses the same profile/result/log inputs to build a PDF in the backend and returns it as a download.
- Empty states are shown when profile or log data is missing; the PDF also reports that no logs exist.

### Doctor directory and clinic profile

- `/doctors` lists `DoctorProfile` rows joined to their owning `User`.
- Doctors can view and submit `/doctor/profile`; non-doctors are redirected to `/home`.
- A profile includes clinic name, specialization, city, address, phone, consultation hours, about text, and optional photo URL.
- No booking, payment, prescription, or patient-record workflow exists.

### Friends, family, messaging, and care alerts

- `/connections` lists accepted connections, pending incoming requests, and a request form.
- `POST /connections/add` looks up a registered email and creates a pending relationship request.
- `POST /connections/accept/{connection_id}` accepts a request addressed to the signed-in user.
- Connected users can load `/connections/{friend_id}/chat`; messages are persisted in `chat_messages`.
- `/ws/chat/{friend_id}` authenticates from the cookie, verifies an accepted connection, stores each incoming message, and broadcasts it to the room.
- `POST /connections/{friend_id}/notify` creates a care-alert message. Its text reflects today's period/cramp or mood entry when present, otherwise it sends a general care request.

### Chatbot

- `/chatbot` presents a browser-based chat panel.
- The browser sends the conversation history to `POST /api/chatbot`.
- `chatbot.py` forwards it to Anthropic when configured; without a key, it returns an explicit not-connected message.
- Chatbot history currently exists only in browser memory and is not persisted.

### Games, yoga, and language

- `/games` links to four client-side games: Zen Bubbles, Aura Runner, Mind Match, and Guess My Craving.
- `/games/invite` persists an invitation as a message to an accepted connection and redirects to their chat.
- `/yoga` presents breathing guidance, six pose cards, a timed guided session, and external tutorial-search links.
- `GET /api/translations/{lang}` returns one of three locale JSON files (`en`, `hi`, `kn`); `lang.js` applies `data-i18n` values and stores the selected language in local storage.

## Existing route inventory

### Public and authentication

| Method | Path | Existing behavior |
|---|---|---|
| GET | `/` | Redirect to `/login` |
| GET | `/login` | Render login form |
| POST | `/login` | Validate password, set JWT cookie, redirect |
| GET | `/signup` | Render signup form |
| POST | `/signup` | Create user, auto-login, redirect |
| GET | `/logout` | Delete cookie and redirect |
| GET | `/api/translations/{lang}` | Return English, Hindi, or Kannada JSON (invalid language falls back to English) |

### Patient and health

| Method | Path | Existing behavior |
|---|---|---|
| GET | `/home` | Authenticated home page |
| GET | `/assessment` | Form with current profile |
| POST | `/assessment` | Save profile and render screening result |
| GET | `/assessment/result` | Recompute result from saved profile |
| GET | `/tracker` | Today's entry and recent history |
| POST | `/tracker` | Create/update today's entry |
| GET | `/reports` | HTML report and charts |
| GET | `/reports/pdf` | Download generated PDF |

### Doctors, connections, and chat

| Method | Path | Existing behavior |
|---|---|---|
| GET | `/doctors` | Authenticated doctor directory |
| GET | `/doctor/profile` | Doctor-only profile form |
| POST | `/doctor/profile` | Create/update own clinic profile |
| GET | `/connections` | Accepted and incoming pending relationships |
| POST | `/connections/add` | Create connection request |
| POST | `/connections/accept/{connection_id}` | Accept incoming request |
| GET | `/connections/{friend_id}/chat` | Load persisted conversation for accepted connection |
| WebSocket | `/ws/chat/{friend_id}` | Authenticated real-time messaging |
| POST | `/connections/{friend_id}/notify` | Persist and broadcast care alert |

### Wellness and chatbot

| Method | Path | Existing behavior |
|---|---|---|
| GET | `/chatbot` | Render chatbot page |
| POST | `/api/chatbot` | Submit conversation history and return a reply |
| GET | `/games` | Games hub and accepted-connection list |
| GET | `/games/bubbles` | Zen Bubbles page |
| GET | `/games/runner` | Aura Runner page |
| GET | `/games/match` | Mind Match page |
| GET | `/games/craving` | Guess My Craving page |
| POST | `/games/invite` | Persist game invitation to chat |
| GET | `/yoga` | Yoga and exercise page |

No `/api/v1` REST API currently exists. Most data-changing operations use HTML form posts and redirects.

## Existing frontend pages

| Template | Purpose |
|---|---|
| `login.html`, `signup.html` | Login and registration; signup selects patient/doctor role |
| `home.html` | Shared welcome page and navigation |
| `assessment.html`, `assessment_result.html` | Profile form and screening output |
| `tracker.html` | Today's entry, gentle relief text, and recent history |
| `reports.html` | Charts, report empty states, PDF link |
| `doctors.html`, `doctor_profile_form.html` | Directory and doctor profile editing |
| `connections.html`, `chat.html` | Requests, care alert, and live chat |
| `chatbot.html` | In-memory GynoBuddy conversation |
| `games.html`, `game_bubbles.html`, `game_runner.html`, `game_match.html`, `game_craving.html` | Games hub and four games |
| `yoga.html` | Breathing, guided session, poses, and tutorial links |

## Forms and primary submitted fields

- Signup: `role`, `full_name`, `email`, `mobile`, `password`, `confirm_password`.
- Login: `email`, `password`.
- Assessment: age/height/weight, cycle regularity and length, and symptom flags.
- Tracker: period status, cramp level, water, exercise, sleep, mood, junk food, notes.
- Doctor profile: clinic, specialization, city/address, phone, hours, photo URL, about.
- Connection: registered email and relationship type; separate accept and care-alert posts.
- Games: selected accepted friend and game name.
- Chatbot: JSON conversation history; social chat: JSON WebSocket message content.
