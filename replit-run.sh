#!/usr/bin/env bash
set -e

# --- Backend ---
pip install -r backend/requirements.txt

# --- Frontend ---
cd frontend
npm install --legacy-peer-deps --no-progress --silent
npm run build
cd ..

# --- Run FastAPI Server ---
export ENV=production
uvicorn backend.main:app --host 0.0.0.0 --port 8000
