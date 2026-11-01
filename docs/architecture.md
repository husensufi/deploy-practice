# Existing Architecture and Refactor Target

## Inspection scope

This is the Phase 1 baseline for the existing Ashwini Asangi PCOS GynoCare application. The original source files and SQLite database were not changed during inspection. Database metadata and row counts were read through a read-only SQLite connection.

## Existing application

The current application is a single FastAPI application:

- `main.py` owns route registration, authentication checks, database queries, server-rendered Jinja2 pages, and the WebSocket chat handler.
- `database.py` creates the SQLAlchemy engine and sessions for `sqlite:///./pcos_gynocare.db`.
- `models.py`, `models_tracker.py`, `models_doctor.py`, and `models_social.py` declare the six database tables.
- `auth.py` hashes passwords and creates/decodes JWTs.
- `detection.py` computes BMI and the rule-based PCOS screening score, with an optional locally trained model estimate.
- `charts.py` generates reports charts as PNG images; `pdf_report.py` assembles downloadable PDFs.
- `chatbot.py` calls Anthropic's Python SDK when `ANTHROPIC_API_KEY` is configured.
- `train_model.py` trains optional Logistic Regression or Random Forest models from a separately supplied dataset. No model or dataset was assumed present.
- `templates/` contains 18 Jinja2 pages. `static/css/style.css`, `static/js/lang.js`, and `static/locales/{en,hi,kn}.json` provide styling and multilingual behavior.

At startup, `main.py` calls `Base.metadata.create_all(bind=engine)`. FastAPI serves both HTML and JSON responses and mounts `/static`; the browser communicates with it using HTML form submissions, `fetch`, and a WebSocket.

## Existing technology and integrations

- Python, FastAPI, Uvicorn, SQLAlchemy 2.x, SQLite, Jinja2, and Pydantic.
- Passlib/bcrypt and python-jose for password hashes and JWTs.
- Matplotlib/Seaborn for charts and ReportLab for PDFs.
- Anthropic SDK for the chatbot; no Azure OpenAI integration currently exists.
- Three.js is loaded from a public CDN by the 3D games. The yoga page links to YouTube search results. The stylesheet imports Google Fonts.
- The requirements file includes packages beyond the modules directly visible in this application (for example, Flet and machine-learning packages).

## Target architecture from the refactor request

Keep the existing application and database as the source of truth while building a parallel application:

1. Establish an independent Vite + React + JavaScript/JSX frontend and a modular FastAPI backend.
2. Keep the existing SQLite file and all six table definitions; make its location configurable and independent of the process working directory.
3. Extract the current route logic into API routers and services without changing assessment formulas or data ownership.
4. Migrate each existing page and interaction to React, retaining form fields, WebSocket behavior, translations, and downloads.
5. Replace the active Anthropic adapter with a server-only Azure OpenAI integration, retaining a clear unavailable/error state when configuration is absent.
6. Add tests around existing behavior before claiming individual features have migrated.

The target API names and desired UI should be treated as proposed structure, not evidence that these capabilities already exist. In particular, assessment history, tracker deletion, patient-consent sharing, and doctor-specific patient-record views are not in the current data model or routes and must not be represented as existing functionality without a separately approved design.

## Existing high-level workflow

See [existing-workflow.md](./existing-workflow.md) for user flows and route inventory. The current [project workflow diagram](../PROJECT_WORKFLOW.md) is a visual overview and should be updated as the migration advances.
