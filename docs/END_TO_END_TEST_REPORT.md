# PCOS GynoCare QA Report

Date: 2026-11-01

## Summary

The reported logout failure was traced to the implementation and fixed. The logout
route now lets FastAPI produce its declared `204 No Content` response while
retaining the cookie deletion header. Regression tests cover both patient and
doctor sessions and confirm subsequent authentication checks fail.

This report records only checks that were run. It is not a claim that every
application feature or interactive control has been exhaustively tested.

## Results

| Area | Status | Evidence |
|---|---|---|
| Logout API, patient and doctor | PASS | Pytest verifies HTTP 204, empty body, expired `access_token` cookie, and `401` from `/auth/me` after logout. |
| Backend automated tests | PASS | `python -m pytest -q -c pytest.ini`: 19 passed. |
| Frontend automated tests | PASS | `npm test`: 8 tests passed across 4 files. |
| Frontend production build | PASS | `npm run build` completed successfully. |
| Backend startup and health endpoint | PASS | Uvicorn started and `GET /api/v1/health` returned HTTP 200. |
| Docker Compose syntax | PASS | `docker compose config --quiet` completed successfully. |
| API route registration | PASS | Application imported with 33 registered HTTP routes; WebSocket route is also registered. |
| Database connectivity | PASS | Read-only `SELECT 1` succeeded against the configured SQLite database. |
| Test database isolation | PASS | Workflow tests use an in-memory SQLite database. |
| Azure OpenAI inference | BLOCKED | Azure responses were mocked in tests; no live inference request was made. |
| Browser end-to-end testing | NOT TESTED | No Playwright/browser-level session was run; frontend tests use jsdom. |
| Full interaction inventory | NOT TESTED | Not every button, link, menu, modal, filter, chart, and form was exercised. |

## Backend workflows exercised

The backend tests exercised these paths:

- Patient and doctor registration and login, authenticated `/auth/me`, duplicate
  registration, invalid email/password confirmation, invalid credentials, and
  missing-secret registration failure.
- Logout cookie deletion for patient and doctor accounts.
- Patient assessment creation and history retrieval, including BMI and risk
  score assertions.
- Daily tracker creation and update, patient dashboard, report summary, and
  PDF response type/signature.
- Doctor-only route protection, doctor profile creation/update, and doctor
  directory retrieval.
- Chat authentication, mocked Azure completion and chat history payload,
  missing Azure configuration, and rejected Azure credentials.
- Connection request creation/listing, invalid connection operations,
  acceptance, care-alert notification, message history, and game invitation.
- WebSocket origin rejection, authenticated message delivery, and message
  persistence.
- Health endpoint, environment precedence, database URL selection, and legacy
  chatbot use of the shared Azure OpenAI service.

Not every registered API endpoint has an automated test. In particular,
per-record assessment retrieval, tracker summary/list routes, doctor lookup by
ID, profile editing validation, alternate care-alert route, and several
negative registration/login inputs remain unverified.

## Frontend workflows exercised

- Login form email validation and mocked successful submission/navigation.
- Signup password-confirmation validation and mocked doctor registration.
- GynoBuddy message submission, Enter-to-send, and Shift+Enter behavior.
- Connection list rendering and connection request submission.
- Logout button request, auth-context state clearing, and redirect to login.

Frontend tests do not represent real backend/browser integration. Signup,
dashboard navigation and data rendering, assessment and tracker forms, report
downloads, doctor workflows, role-specific route behavior after a hard reload,
WebSocket reconnection, translations, yoga/exercise, and wellness game controls
were not comprehensively exercised.

## Security and data handling

- Logout removes the browser's HttpOnly access-token cookie. This application
  uses stateless JWT cookies and does not maintain a server-side token
  revocation list; a separately copied, unexpired token is not revoked by this
  endpoint.
- An existing role-protection test confirms a patient cannot access the
  doctor-only patient profile endpoint. Broader patient-record isolation and
  doctor authorization cases were not exhaustively tested.
- No Azure OpenAI variable or provider reference was found in the frontend
  source/configuration scan. The project `.env` is ignored by Git and is not
  tracked.
- Workflow tests use an isolated in-memory database. The live project database
  was only queried with `SELECT 1`; no test performed writes against it.
- No penetration test, full authorization matrix, or exhaustive secret scan
  was performed.

## Fixed issues

1. `/api/v1/auth/logout` returned FastAPI's injected `Response` object directly.
   That object could have `status_code=None`, producing the reported
   `KeyError`. The route now returns no body so FastAPI creates the declared
   204 response and copies the cookie deletion header.
2. The legacy chatbot test imported `backend.legacy` while pytest is run from
   the `backend` directory. It now imports `legacy`, matching the configured
   backend test import root and allowing the documented test command to collect
   successfully.

## Remaining work

The app has not had a comprehensive manual QA pass or browser-based E2E run.
Additional registration validation edge cases and real UI-to-API authentication,
cycle tracking, complete doctor patient-management/privacy workflows, all
interactive controls, localization, yoga/exercises, game play, report contents,
and live Azure behavior should be tested before treating the whole product as
fully verified.
