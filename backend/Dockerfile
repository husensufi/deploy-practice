FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend/__init__.py /app/backend/__init__.py
COPY backend/ai /app/backend/ai
COPY backend/app /app/backend/app
COPY backend/legacy /app/backend/legacy

ENV PYTHONPATH="/app/backend:/app"
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000"]
