#!/usr/bin/env bash
set -e

# Ensure production env flag
export ENV=production

# Use Replit provided port if available
PORT=${PORT:-8000}

# Build frontend automatically so FastAPI serves fresh assets from frontend/dist
echo "Building frontend..."
(
  cd frontend
  if [ ! -d node_modules ]; then
    echo "Installing frontend dependencies..."
    npm ci --legacy-peer-deps
  fi
  rm -rf dist
  npm run build --silent
)

echo "Starting Uvicorn on port $PORT"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
