# Existing Architecture and Refactor Target

## Inspection scope

This is the Phase 1 baseline for the existing Ashwini Asangi PCOS GynoCare application. The original source files and SQLite database were not changed during inspection. Database metadata and row counts were read through a read-only SQLite connection.

## Existing application

The current application is a single FastAPI application:

- `backend/app/` owns the modular versioned JSON API, security, database session, schemas, and service layer.
- `backend/legacy/` contains the retained Jinja2 FastAPI server, original SQLAlchemy model declarations, authentication/scoring/report logic, and ML trainer.
- `frontend/src/` contains the React/Vite application. `frontend/legacy_templates/` and `frontend/public/static/` retain the legacy Jinja pages, styling, scripts, and locales while their workflows are migrated.
- `backend/legacy/database.py` and `backend/app/core/config.py` both resolve the existing root-level `pcos_gynocare.db` by absolute path. They share the original model definitions and database schema.
- `backend/legacy/detection.py` computes BMI and the rule-based PCOS screening score, with an optional locally trained model estimate stored under `backend/models/`.
- `backend/legacy/charts.py` generates report charts and `backend/legacy/pdf_report.py` assembles downloadable PDFs.
- AI features use structured Markdown system prompts in `backend/app/prompts/`, loaded by `backend/app/services/ai.py`. Each prompt defines its role, objective, input trust boundaries, safety/privacy rules, and response format. Both legacy and React GynoBuddy interfaces use the same prompt loader and shared Azure OpenAI client in `backend/ai/azure_openai.py`.
- `backend/legacy/train_model.py` trains optional Logistic Regression or Random Forest models from a separately supplied dataset.

The legacy app still calls `Base.metadata.create_all(bind=engine)` at startup and serves Jinja templates/static assets through FastAPI. The new API does not create tables automatically. Both applications use the single existing root database; run only one server on a given port at a time.

## Existing technology and integrations

- Python, FastAPI, Uvicorn, SQLAlchemy 2.x, SQLite, Jinja2, and Pydantic.
- Passlib/bcrypt and python-jose for password hashes and JWTs.
- Matplotlib/Seaborn for charts and ReportLab for PDFs.
- Azure OpenAI SDK for both chatbot interfaces; provider credentials are loaded only by the backend.
- Three.js is loaded from a public CDN by the 3D games. The yoga page links to YouTube search results. The stylesheet imports Google Fonts.
- The requirements file includes packages beyond the modules directly visible in this application (for example, Flet and machine-learning packages).

## Target architecture from the refactor request

Keep the existing application and database as the source of truth while building a parallel application:

1. Establish an independent Vite + React + JavaScript/JSX frontend and a modular FastAPI backend.
2. Keep the existing SQLite file and all six table definitions; make its location configurable and independent of the process working directory.
3. Extract the current route logic into API routers and services without changing assessment formulas or data ownership.
4. Migrate each existing page and interaction to React, retaining form fields, WebSocket behavior, translations, and downloads.
5. Keep all LLM calls behind the shared Azure OpenAI service, retaining clear unavailable/error states when configuration or credentials are invalid.
6. Add tests around existing behavior before claiming individual features have migrated.

The target API names and desired UI should be treated as proposed structure, not evidence that these capabilities already exist. In particular, assessment history, tracker deletion, patient-consent sharing, and doctor-specific patient-record views are not in the current data model or routes and must not be represented as existing functionality without a separately approved design.

## Existing high-level workflow

See [existing-workflow.md](./existing-workflow.md) for user flows and route inventory. The [project workflow diagram](./project-workflow.md) is a visual overview of the current migration.
