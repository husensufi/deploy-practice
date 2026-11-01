# Existing API and Route Reference

This document covers both the original HTML routes in `backend/legacy/main.py` and the new `/api/v1` backend APIs. The original app remains available as a parallel fallback.

## Authentication and language

| Method | Path | Input | Result/access |
|---|---|---|---|
| GET | `/` | None | Redirects to `/login` |
| GET | `/login` | None | Renders form |
| POST | `/login` | Form: `email`, `password` | Sets `access_token` cookie and redirects, or renders an error |
| GET | `/signup` | None | Renders form |
| POST | `/signup` | Form: `full_name`, `email`, `mobile`, `password`, `confirm_password`, optional `role` | Creates user, auto-logs in, redirects, or renders an error |
| GET | `/logout` | Cookie | Deletes cookie and redirects |
| GET | `/api/translations/{lang}` | `lang` path value | Returns locale JSON; unsupported values use English |

## Patient health and reports

All listed page routes require a valid access token; otherwise they redirect to `/login`.

| Method | Path | Input/result |
|---|---|---|
| GET | `/home` | Render authenticated user's shared home page |
| GET | `/assessment` | Render the user's current profile in the assessment form |
| POST | `/assessment` | Form fields: `age`, `height_cm`, `weight_kg`, `cycle_regularity`, `avg_cycle_length_days`, seven symptom flags; upserts the user's profile and returns the screening result page |
| GET | `/assessment/result` | Recalculate and render result; redirects to `/assessment` if no profile |
| GET | `/tracker` | Render today's log and up to 14 recent logs |
| POST | `/tracker` | Form fields: period flag, cramp level, water, exercise, sleep, mood, junk-food flag, notes; upserts today's log and redirects |
| GET | `/reports` | Render profile, screening result when a profile exists, up to 30 recent logs, and charts |
| GET | `/reports/pdf` | Return an `application/pdf` download built from the current user's data |

## Doctors, connections, and chat

| Method | Path | Input/result |
|---|---|---|
| GET | `/doctors` | Render directory of doctor profiles and their users |
| GET | `/doctor/profile` | Doctor-only edit form; other roles redirect to `/home` |
| POST | `/doctor/profile` | Doctor-only form post; create/update own public clinic profile |
| GET | `/connections` | Render current user's accepted connections and incoming pending requests |
| POST | `/connections/add` | Form: `friend_email`, `relationship_type`; create pending request |
| POST | `/connections/accept/{connection_id}` | Accept a request addressed to current user |
| GET | `/connections/{friend_id}/chat` | Render persisted messages after accepted-connection check |
| WebSocket | `/ws/chat/{friend_id}` | Cookie-authenticated chat, connection check, message persistence and room broadcast |
| POST | `/connections/{friend_id}/notify` | Create a care alert based on today's tracker state and redirect to chat |

## Chatbot, games, and yoga

| Method | Path | Input/result |
|---|---|---|
| GET | `/chatbot` | Render chatbot UI |
| POST | `/api/chatbot` | JSON: `{ "history": [{"role": "...", "content": "..."}] }`; returns `{ "reply": "..." }` |
| GET | `/games` | Render games hub with accepted connections for invitations |
| GET | `/games/bubbles` | Render Zen Bubbles |
| GET | `/games/runner` | Render Aura Runner |
| GET | `/games/match` | Render Mind Match |
| GET | `/games/craving` | Render Guess My Craving |
| POST | `/games/invite` | Form: `friend_id`, `game_name`; store invitation as chat message |
| GET | `/yoga` | Render yoga/exercise page |

The game and yoga pages are currently client-side interactions embedded in HTML. They do not have game-score APIs.

## Target API notes

## New `/api/v1` JSON API

The independent backend uses Pydantic request/response schemas. Protected endpoints require the `access_token` httpOnly cookie. The browser frontend must send credentials for cross-origin development.

| Method | Path | Access and behavior |
|---|---|---|
| GET | `/api/v1/health` | Public liveness response |
| POST | `/api/v1/auth/register` | Register patient/doctor; hash password; set cookie |
| POST | `/api/v1/auth/login` | Verify credentials; set cookie |
| POST | `/api/v1/auth/logout` | Clear cookie |
| GET | `/api/v1/auth/me` | Current authenticated account |
| GET / PUT | `/api/v1/patients/me` | Patient-only current account read/update |
| GET | `/api/v1/patients/dashboard` | Patient-only profile, current screening result, today's log, recent logs |
| POST | `/api/v1/assessments` | Patient-only create/update the existing single `PCOSProfile`; return current result |
| GET | `/api/v1/assessments/history` | Patient-only list; currently contains at most the single profile because the existing schema has no history table |
| GET | `/api/v1/assessments/{assessment_id}` | Patient-only read of own profile row |
| GET / POST | `/api/v1/tracker/daily` | Patient-only list recent logs / upsert today's log |
| PUT | `/api/v1/tracker/daily/{record_id}` | Patient-only update an owned log |
| GET | `/api/v1/tracker/summary` | Patient-only total entry count, latest entry, today's entry |
| GET | `/api/v1/doctors` | Authenticated public directory |
| GET | `/api/v1/doctors/{doctor_id}` | Authenticated doctor directory profile |
| GET / PUT | `/api/v1/doctors/me` | Doctor-only own clinic profile |
| GET | `/api/v1/reports` | Patient-only profile, current screening result, recent logs for React charts |
| GET | `/api/v1/reports/pdf` | Patient-only backend-generated PDF |
| GET | `/api/v1/connections` | Authenticated accepted and pending connections |
| POST | `/api/v1/connections` | Authenticated JSON `{ "friend_email": "...", "relationship_type": "friend" }`; create a pending request |
| POST | `/api/v1/connections/{connection_id}/accept` | Accept an incoming pending request |
| GET | `/api/v1/connections/{friend_id}/chat` | Return persisted messages for an accepted connection |
| POST | `/api/v1/connections/{friend_id}/care-alert` or `/notify` | Create and broadcast a care alert based on today's tracker state |
| POST | `/api/v1/connections/{friend_id}/games/invite` | JSON `{ "game_name": "Mind Match" }`; persist a game invitation in the connected user's chat |
| WebSocket | `/api/v1/ws/chat/{friend_id}` | Cookie-authenticated chat; requires the configured frontend `Origin` and an accepted connection; persists and broadcasts messages |
| GET | `/api/v1/wellness/tutorials` | Patient-only legacy yoga and breathing tutorial catalog, including instructions and video-search links |
| GET | `/api/v1/wellness/tutorials/{tutorial_id}` | Patient-only detail for one yoga or breathing tutorial; unknown IDs return 404 |
| GET | `/api/v1/wellness/games` | Patient-only catalog for the four legacy wellness games |

The API reuses the original ORM models and screening/PDF modules through a narrow legacy adapter; it does not call `create_all()` and has not changed the SQLite schema. The original root routes are still in place.

| POST | `/api/v1/chat/reply` | Authenticated; sends up to 20 recent user/assistant messages to the configured Azure OpenAI deployment and returns a generated reply |

Azure credentials are read only by the backend from the process environment, `backend/.env`, or as a fallback from the project root `.env`: `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_VERSION`. Process variables take precedence, followed by populated `backend/.env` values; the root `.env` fills missing or blank settings. Missing configuration returns HTTP 503; provider failures return HTTP 502 without exposing credentials or upstream exception details. The React app keeps the current conversation in memory and shows service errors explicitly.

Social API routes, persistent WebSocket chat, and the React connections/chat UI are implemented. The React app now also exposes the patient-only wellness tutorial and game catalogs and client-side gameplay. Legacy HTML routes remain as a fallback. The new React wellness pages are English-only; the retained legacy locale JSON files are not wired into the React app. The legacy app has no separate exercise-routine catalog or game-score persistence. Do not add a patient-sharing API until consent and authorization semantics are designed.
