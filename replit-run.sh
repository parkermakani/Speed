#!/usr/bin/env bash
set -e

# Ensure production env flag
export ENV=production

# Use Replit provided port if available
PORT=${PORT:-8000}
echo "Starting Uvicorn on port $PORT"
exec uvicorn backend.main:app --host 0.0.0.0 --port "$PORT"
