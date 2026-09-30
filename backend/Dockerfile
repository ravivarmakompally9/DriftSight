# DriftSight API
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

# curl is only here for the container healthcheck
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY app ./app

# Train the detector at build time so the first request is fast and the image is
# self-contained. The artefact is deterministic for a fixed seed.
RUN mkdir -p /app/models \
 && python -c "from app.detect.model import get_detector; d = get_detector(); print(f'detector accuracy {d.accuracy:.4f}')"

ENV DRIFTSIGHT_DATABASE_URL=sqlite:////data/driftsight.db \
    DRIFTSIGHT_MODEL_PATH=/app/models/detector.joblib
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=20s --timeout=4s --start-period=40s --retries=5 \
  CMD curl -fsS http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
