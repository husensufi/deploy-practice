# Local Setup

The project has a modular FastAPI API and React/Vite frontend. The original Jinja2 application, translations, and features not yet migrated are retained under `backend/legacy/` and `frontend/legacy_templates/`.

## Requirements

- Python 3.11 or newer
- Node.js 20.19+ or 22.12+ with npm
- Windows PowerShell examples below; adapt paths for another operating system

## New React frontend and API

Create a Python environment and install API dependencies from the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Set a `SECRET_KEY` of at least 32 characters in `backend\.env` (generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"`). The default database is the original root-level `pcos_gynocare.db`; leave `DATABASE_URL` unset unless you intentionally need an alternate persistent SQLite file. Configure the Azure OpenAI endpoint, key, deployment, and API version in `backend\.env` or the project root `.env` to enable GynoBuddy. The process environment takes precedence, followed by `backend\.env`, with the root `.env` used to fill missing or blank values.

Start the API from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

In another terminal:

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open <http://localhost:5173>. API docs are at <http://localhost:8000/docs>. Keep `FRONTEND_URL` in the backend environment matched with the browser origin.

## Original server-rendered application

Use a separate environment for the original application and ML dependencies:

```powershell
python -m venv legacy-venv
.\legacy-venv\Scripts\Activate.ps1
python -m pip install -r backend\legacy\requirements.txt
uvicorn legacy.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Open <http://localhost:8000>. It uses the same original SQLite database, legacy Jinja templates in the frontend tree, and assets under `frontend/public/static`. Run either the legacy app or the API on port 8000 at a time. Both chat interfaces use the same optional Azure OpenAI configuration from `backend/.env` or root `.env`; set the endpoint, key, deployment, and API version (`2024-10-21` by default).

## Tests and build

Run backend tests from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest -q -c backend\pytest.ini
```

Run frontend tests and build:

```powershell
Set-Location frontend
npm test
npm run build
```

Tests use isolated in-memory SQLite and do not alter the canonical database. Never delete or reset `pcos_gynocare.db`.

## Optional ML model training

The retained trainer uses the legacy environment's pandas, scikit-learn, and joblib packages. It expects a separately supplied, properly licensed dataset:

```powershell
python -m backend.legacy.train_model path\to\your_dataset.csv
```

Model artifacts and reports are generated under `backend/models/`. No dataset or trained artifact is included in the repository.

## AI configuration

The React app and retained legacy chatbot share the Azure OpenAI service and credentials in `backend/ai/azure_openai.py`, reading centralized settings from the process environment and `backend/.env`, with root `.env` fallback. The configured deployment is used for every chat request. Do not put credentials in frontend environment files or source control. If required settings are missing or invalid, the chatbot reports an explicit configuration/service error.
