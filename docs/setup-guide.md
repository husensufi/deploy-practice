# Existing Local Setup

These are the instructions for running the original application during the migration. The existing app remains at the project root until a replacement is tested and accepted.

## Prerequisites

- Python 3.11 or 3.12 is recommended by the existing README.
- PowerShell or a VS Code terminal on Windows.

## Install and run

From the project root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000`. FastAPI's OpenAPI page is at `http://127.0.0.1:8000/docs`.

The server currently reads `sqlite:///./pcos_gynocare.db` relative to the working directory. Start it from the project root to ensure it uses the intended file. Correcting this path to a configurable absolute location is a migration requirement; do not move, replace, or duplicate the original database as part of setup.

## Chat and backend configuration

The original server-rendered app still uses its legacy `ANTHROPIC_API_KEY` integration. The independent React app uses Azure OpenAI through the backend only. Copy `backend/.env.example` to `backend/.env`, set a random `SECRET_KEY` of at least 32 characters, and configure the Azure endpoint, key, deployment name, and API version to enable GynoBuddy. The checked-in example contains placeholders, not working credentials. Never copy real credentials into source or documentation. Without Azure settings, the chat API explicitly responds with HTTP 503.

Generate a secret locally with:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

## Current test status

Backend API tests use an isolated in-memory SQLite database. Frontend tests run in Vitest and mock the API for authentication and GynoBuddy workflows. These do not modify the original database. Run them with:

```powershell
..\.venv\Scripts\python.exe -m pytest -q
npm test
npm run build
```

## New application scaffold (feature migration in progress)

The independent Vite frontend and FastAPI backend now include authentication, patient assessment/tracking/reports, doctor directory/profile, and the Azure-backed chat interface. Social messaging, games, yoga, and language switching are still being migrated. Keep the original application available until the remaining workflows are implemented and verified.

```powershell
Set-Location frontend
npm install
npm run dev
```

```powershell
Set-Location backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
