# Ashwini Asangi PCOS GynoCare

PCOS GynoCare is a health-support application with a legacy FastAPI/Jinja2 interface and a newer React/Vite frontend backed by a modular FastAPI API. The migration is in progress: the legacy application remains available while features are moved to the new frontend.

> **Health information:** The PCOS assessment is a screening aid, not a medical diagnosis. Consult a qualified healthcare professional about health concerns.

## Features

### New React + API application

- Patient and doctor registration, login, and logout using secure HTTP-only authentication cookies.
- Patient dashboard, PCOS screening assessment, daily tracker, reports, and PDF download.
- Doctor directory and doctor clinic profile management.
- Friends and family connection requests, accepted-connection chat history, real-time WebSocket chat, care alerts, and game invitations.
- GynoBuddy chat through a backend-configured Azure OpenAI deployment.
- API documentation exposed by FastAPI.

The existing SQLite database and current screening logic are reused. The new backend does not create or migrate database tables automatically.

### Legacy application

The original FastAPI/Jinja2 interface remains available as a fallback. It also contains features not yet migrated to React, including the games hub and individual games, yoga/exercise, and language switching (English, Hindi, and Kannada).

## Project layout

```text
pcos_gynocare/
├── backend/                 # Modular API, preserved legacy backend, and tests
│   ├── app/
│   ├── legacy/
│   ├── Dockerfile
│   ├── pytest.ini
│   ├── .env.example
│   └── requirements.txt
├── frontend/                # React + Vite plus preserved legacy UI/assets
│   ├── src/
│   ├── legacy_templates/
│   ├── public/static/
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
├── docs/                    # Architecture, setup, API, and migration notes
├── .dockerignore
├── .env.example             # Legacy chatbot key template
├── .gitignore
├── docker-compose.yml
├── README.md
└── pcos_gynocare.db          # Existing SQLite database; preserve this file
```

## Requirements

- Windows 10/11 with PowerShell (commands below use PowerShell syntax).
- Python 3.11 or newer. Python 3.11 is used by the current project environment.
- Node.js `20.19+` or `22.12+` (npm is included with Node.js).

Check the installed tools:

```powershell
python --version
node --version
npm --version
```

## Run the React application and API

Run the API and frontend in **two separate terminals**, from the repository root.

### 1. Set up the Python API

Create and activate a virtual environment, then install the API dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
```

If PowerShell prevents environment activation, either allow it for the current terminal with `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, or call the virtual-environment executables directly as shown in the test commands below.

Copy the backend settings template:

```powershell
Copy-Item backend\.env.example backend\.env
```

Edit `backend\.env` before running the API:

- Set `SECRET_KEY` to a new random value at least 32 characters long. Generate one locally:

  ```powershell
  .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
  ```

- **Use the existing project database.** The default database path is resolved from the repository location, independent of the current directory. Leave `DATABASE_URL` unset to use that default. If you set it, point it to the existing `pcos_gynocare.db` file with an absolute SQLite URL; do not use `:memory:` or a new database path unless intentionally testing against a separate database.
- `ENVIRONMENT=development` is suitable for local development.
- `FRONTEND_URL=http://localhost:5173` must match the browser's frontend origin. If Vite uses another port or hostname, update this setting and restart the API.
- Both GynoBuddy chat interfaces use one backend-only Azure OpenAI service and deployment. To enable chat, configure `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_VERSION` in `backend/.env`. The API version defaults to `2024-10-21`. Without the required settings, chat returns a clear configuration error rather than a canned response.

Keep all real credentials in `backend\.env`. Never paste secrets into source files, README content, screenshots, issue reports, or commits. The `.env` files are ignored by Git.

Start the API from the repository root:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The API is available at:

- Health check: <http://localhost:8000/api/v1/health>
- Swagger UI: <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

### 2. Set up the React frontend

Open another PowerShell terminal at the repository root:

```powershell
Set-Location frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open the Vite URL shown in the terminal (normally <http://localhost:5173>). The checked-in `frontend/.env.example` points the frontend to `http://localhost:8000/api/v1`; adjust `VITE_API_BASE_URL` in `frontend/.env` if the API runs elsewhere.

Register a patient or doctor account in the new application to get started. Doctors can complete a clinic profile from their dashboard; patient-only pages are protected by role.

### Stop and restart

Press `Ctrl+C` in each terminal to stop its server. On a later run, start the API and frontend again:

```powershell
# API terminal, from the repository root
.\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

```powershell
# Frontend terminal
Set-Location frontend
npm run dev
```

There is no need to reinstall dependencies unless a dependency manifest changes.

## Run the legacy application

The legacy app is optional when using the React frontend. To run it, use a separate virtual environment so the legacy dependency pins do not conflict with the new API environment:

```powershell
python -m venv legacy-venv
.\legacy-venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\legacy\requirements.txt
uvicorn backend.legacy.main:app --reload --host 127.0.0.1 --port 8000
```

Then open <http://localhost:8000>. The legacy app and new API both default to port `8000`; stop one before starting the other, or configure a different port.

The legacy and React GynoBuddy interfaces share the backend Azure OpenAI service. Configure the provider once by copying `backend\.env.example` to `backend\.env` and setting the Azure endpoint, API key, deployment name, and API version. The legacy app loads this same backend configuration. Keep credentials server-side; never add them to frontend environment files or expose them through API responses.

## Run with Docker Compose

Create `backend\.env` as described above before starting the containers. Docker Compose builds the React/Vite dev server and modular FastAPI API, exposes ports 5173/8000, and bind-mounts the existing root database file; it does not initialize or replace the database.

```powershell
docker compose up --build
```

Open <http://localhost:5173>. To stop the containers without removing the database:

```powershell
docker compose down
```

Do not use `docker compose down -v` as part of normal cleanup.

## Optional ML model training

The trainer is retained at `backend\legacy\train_model.py`. Install the legacy dependencies (including pandas, scikit-learn, and joblib), then provide your own properly licensed CSV/XLSX dataset:

```powershell
python -m backend.legacy.train_model path\to\your_dataset.csv
```

Generated model artifacts and reports are saved under `backend\models\`; the API can load the trained model from that directory. Dataset files are not included in this repository.

## Tests and production build

From the repository root, with the backend virtual environment and frontend dependencies installed:

```powershell
# Backend tests use an isolated in-memory SQLite database.
.\.venv\Scripts\python.exe -m pytest -q -c backend\pytest.ini

# Frontend tests
Set-Location frontend
npm test

# Production frontend build
npm run build
```

The frontend build is written to `frontend\dist\`. To preview a production build locally, run:

```powershell
npm run preview
```

## Database and data safety

- The existing `pcos_gynocare.db` is the canonical local database; keep a backup before manually editing or moving it.
- The new API references the current project database by default, using an absolute path derived from the backend location.
- API tests use an isolated in-memory SQLite database and should not modify the canonical database.
- No automatic schema migration is performed by the new API. Do not delete the database or run schema-changing scripts as part of normal setup.
- Assessment data is stored as the user's current profile; the current schema does not retain multiple assessment submissions as history.

## Troubleshooting

### `SECRET_KEY` is missing or too short

Set `SECRET_KEY` in `backend\.env` to a locally generated value of at least 32 characters, then restart the API.

### Browser cannot call the API

Confirm that the API is running, `frontend\.env` has the correct `VITE_API_BASE_URL`, and `FRONTEND_URL` in `backend\.env` exactly matches the Vite browser origin, including hostname and port. Restart both servers after changing either file.

### WebSocket chat does not connect

Sign in first, confirm that the connection request has been accepted, and ensure the frontend origin matches `FRONTEND_URL`. Chat access requires both a valid session cookie and an accepted connection.

### GynoBuddy reports that it is not configured

Set the four Azure OpenAI variables in `backend\.env` and restart the API. The modular API and legacy chatbot use the same configured deployment through `backend/ai/azure_openai.py`. Never put the Azure API key in the frontend environment.

### Port 8000 is already in use

Stop the other server using that port, or start the API on another port and update `VITE_API_BASE_URL` accordingly. If the frontend hostname or port changes, also update `FRONTEND_URL`.

## Documentation

- [Project workflow diagram](docs/project-workflow.md)
- [Architecture](docs/architecture.md)
- [API documentation and route reference](docs/api-documentation.md)
- [Existing application workflow](docs/existing-workflow.md)
- [Database notes](docs/database.md)
- [Feature preservation checklist](docs/feature-preservation-checklist.md)
- [Technical findings](docs/technical-findings.md)
