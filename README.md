# Speed Live Map

A mobile-first React web app with a live location marker on a Mapbox map and real-time quote updates via a FastAPI backend.

## Project Structure

```
├── frontend/          # React + TypeScript (Vite)
├── backend/           # FastAPI + SQLModel
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Mapbox access token (for frontend)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs on http://localhost:8000

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on http://localhost:5173

## Environment Variables

- Copy `env.example` to `.env` at the project root (ignored by Git) and fill in secrets.
- All frontend variables are prefixed with `VITE_`.

```
# .env (local)
ENV=development
MAPBOX_TOKEN=your_mapbox_token
ADMIN_PASSWORD=super_secure_password
JWT_SECRET=super_secret_jwt
GOOGLE_PLACES_API_KEY=your_google_places_api_key

# Front-end (Vite)
VITE_MAPBOX_TOKEN=$MAPBOX_TOKEN
VITE_API_BASE_URL=http://localhost:8000
```

> **Note**: On Replit you will add these keys in the **Secrets** tab instead of a physical `.env` file.

### Local Development Commands

```bash
# start backend (auto-reload)
uvicorn backend.main:app --reload

# in another terminal start frontend dev server
cd frontend && npm run dev
```

### Deploying to Replit

1. Fork/import this repo into Replit.
2. Open the Secrets tab and add the same keys as in `.env` (**MAPBOX_TOKEN**, **ADMIN_PASSWORD**, **JWT_SECRET**, **GOOGLE_PLACES_API_KEY**). Replit automatically injects them as environment variables.
3. Ensure **ENV=production** is set in the Secrets so FastAPI serves the built frontend.
4. Click **Run**. Replit executes `bash replit-run.sh` defined in `.replit` which:
   - installs Python deps (`pip install -r backend/requirements.txt`)
   - installs Node deps & builds the React app (`npm install && npm run build`)
   - starts FastAPI on port 8000 and mounts the `frontend/dist` folder
5. The repl will expose the web server on its assigned public URL.

### Production Build (Docker optional)

```bash
bash replit-run.sh   # replicates the build/run locally
```

## Docker Setup

```bash
# Backend
cd backend
docker build -t speed-backend .
docker run -p 8000:8000 speed-backend

# Frontend
cd frontend
docker build -t speed-frontend .
docker run -p 80:80 speed-frontend
```

## API Endpoints

- `GET /status` - Returns current location and quote
- `POST /status` - Updates location and quote (admin only)
- `POST /auth/login` - Admin authentication
- `POST /auth/logout` - Admin logout

## Development Status

✅ Project scaffolding complete
🚧 Design tokens and UI primitives (next)
🚧 Map integration with pulsing marker
🚧 Admin dashboard
🚧 Authentication system
