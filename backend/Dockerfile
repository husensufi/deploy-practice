FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/backend/requirements.txt
RUN python -m pip install --no-cache-dir -r /app/backend/requirements.txt

COPY __init__.py /app/backend/__init__.py
COPY ai /app/backend/ai
COPY app /app/backend/app
COPY legacy /app/backend/legacy

ENV PYTHONPATH="/app/backend:/app"
EXPOSE 8000

CMD ["python", "-m", "uvicorn", "app.main:app", "--app-dir", "/app/backend", "--host", "0.0.0.0", "--port", "8000"]
