#!/usr/bin/env bash
set -e

# --- Backend ---
pip install -r backend/requirements.txt

# --- Frontend ---
cd frontend
npm install --legacy-peer-deps
npm run build
cd ..

# --- Run FastAPI Server ---
UVICORN_PORT=${PORT:-8000}
exec uvicorn backend.main:app --host 0.0.0.0 --port "$UVICORN_PORT"
