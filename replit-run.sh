#!/usr/bin/env bash
set -e

# Ensure production env flag
export ENV=production
# Force same-origin API in builds/runs (override any secret)
export VITE_API_BASE_URL=

# Use Replit provided port if available
PORT=${PORT:-8000}

# Build frontend automatically so FastAPI serves fresh assets from frontend/dist
REBUILD=0
if [ -d frontend/dist ]; then
  if grep -aq "localhost:8000" frontend/dist/assets/index-*.js 2>/dev/null; then
    echo "Detected stale dist (localhost:8000). Rebuilding..."
    REBUILD=1
  else
    echo "Using existing frontend/dist (skipping build)"
  fi
else
  REBUILD=1
fi

if [ "$REBUILD" = "1" ]; then
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
fi

echo "Starting Uvicorn on port $PORT"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
