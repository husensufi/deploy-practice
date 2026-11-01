# Phase 1 Technical Findings and Migration Plan

## Findings

1. **Monolithic route module:** `main.py` mixes HTML rendering, forms, auth checks, SQLAlchemy queries, WebSocket management, report generation calls, and feature handlers.
2. **Relative database path:** `sqlite:///./pcos_gynocare.db` depends on the current working directory. The new backend must resolve the existing file reliably and must not initialize a second empty database accidentally.
3. **Schema bootstrap on import:** `Base.metadata.create_all()` executes during `main.py` import. Startup behavior should be explicit and must not be used as a substitute for controlled migrations.
4. **Authentication secret is hard-coded:** `auth.py` defines a default JWT secret in source. Move configuration to backend environment variables and require a secure secret in non-development deployments.
5. **Cookie policy is incomplete for production:** the token is `httpOnly`, but current `set_cookie` calls do not specify `secure` or `samesite`. Configure these based on deployment and the frontend/backend origin strategy.
6. **No CORS/API boundary yet:** the current HTML application is served from the same FastAPI origin; independent Vite development requires deliberate CORS and credential configuration.
7. **HTML-first handlers:** most feature handlers return templates or redirects. The target frontend needs JSON schemas and API routes, while preserving the original field behavior and redirects where appropriate.
8. **Data model limitations:** `PCOSProfile` is one-to-one with user and overwritten on submit; there is no assessment history. The `daily_logs` table has no unique database constraint for `(user_id, log_date)` although the route upserts by that pair.
9. **Consent model absent:** doctor profiles are public in the directory, but there are no patient report-sharing grants or authorized patient-record routes. Do not expose clinical records to doctors or their chatbot without designing consent and access controls.
10. **Chatbot uses Anthropic:** `chatbot.py`, `.env.example`, and `requirements.txt` reference Anthropic. Responses expose exception text to the caller, while unavailable configuration is represented as a reply string. Azure replacement should use server-only credentials and explicit HTTP/API errors.
11. **Error handling and logging:** the WebSocket broadcast and optional ML estimation paths catch broad exceptions; the chatbot also catches broadly. Tighten error handling during the migration without silently converting operational failures to success.
12. **No project tests found:** add tests before claiming behavior parity. Existing `detection.py` is a suitable first target for deterministic tests.
13. **Page/UI limitations:** the home page is a welcome shell rather than the data-driven dashboard described in the target. Several pages share navigation; game pages contain inline scripts and load Three.js from a CDN. There is no doctor-specific dashboard today.
14. **Unimplemented UI action:** the login template's “Forgot Password?” link points to `#`; no reset workflow or route exists.
15. **No custom REST API versioning:** current JSON routes are `/api/translations/{lang}` and `/api/chatbot`; no `/api/v1` router exists.

## Implementation plan

1. Keep root source, `.env`, and `pcos_gynocare.db` intact. Create a verified database backup only before any future schema/data-changing operation.
2. Establish `backend/` and `frontend/` as parallel applications without removing the current runnable prototype.
3. Make the backend's database URL configurable but default it to the canonical existing database file via an absolute path.
4. Add API/auth schemas and services, extracting existing score/tracker/report logic rather than rewriting the rules.
5. Establish API and WebSocket ownership checks before moving any patient data into new endpoints.
6. Migrate frontend feature groups from auth and dashboard into assessment/tracker/reports, then doctors/social, games/yoga/i18n.
7. Replace Anthropic with Azure OpenAI behind an explicit service boundary. Use configured Azure deployment and return clear errors if configuration or service availability is missing.
8. Add automated tests per migrated feature and compare the old and new workflows before switching users to React.
9. Complete setup, API, database, architecture, Azure, and operational documentation after the migrated application passes tests.

## Phase 1 verification record

- Inspected existing Python modules, route declarations, all 18 HTML templates, stylesheet, language script, and three locale files.
- Locale files have matching key sets (167 keys each).
- Inspected database schema and row counts read-only: six tables; one row in `users`; zero in each other application table.
- No project test files were found.
- No source code or database changes were made during inspection.

## Phase 2 architecture scaffold

- Added independent `backend/` and `frontend/` applications without moving or replacing the original app.
- Backend has a versioned health endpoint, environment-backed SQLite URL resolution to the existing root database, and a frontend-origin CORS configuration. It deliberately does not call `create_all()` or mutate the database.
- Frontend has a Vite/React/JSX shell, centralized Axios API client, and React Query/Router providers. Feature routes and legacy-data screens are not migrated yet.
- Added baseline health/status tests. Frontend dependencies are audited with `npm audit` and currently report zero vulnerabilities.
- Phase 2 verification passed: backend tests, frontend build, frontend tests, and dependency audit.

## Phase 3 backend migration progress

- Added JSON APIs for auth, patient self-service/dashboard, assessment, daily tracking, doctor profiles/directory, and report data/PDF.
- Reused the original SQLAlchemy model classes and existing screening and report code through `app.core.legacy`; the backend engine resolves to the same project-root database file.
- Added role and record-ownership checks for patient/doctor APIs. No patient health data is returned by doctor directory APIs.
- Tests use an isolated in-memory SQLite database. They cover signup/auth, screening score and BMI, tracker create/update, dashboard, report/PDF response, doctor authorization/profile, and missing-secret behavior.
- Added an authenticated Azure OpenAI chat endpoint and shared React GynoBuddy widget. Provider credentials remain backend-only; missing configuration and provider failures have explicit HTTP error responses. Backend tests mock the Azure client; frontend tests verify the widget request/reply flow.
- Social connections/WebSocket routes remain in later migration phases. The original prototype is still available in parallel during migration.
