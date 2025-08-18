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

### Environment Variables

Create `.env` files in both frontend and backend directories:

**backend/.env**
```
ADMIN_PASSWORD=your_admin_password
JWT_SECRET=your_jwt_secret
```

**frontend/.env**
```
VITE_MAPBOX_TOKEN=your_mapbox_token
VITE_API_BASE_URL=http://localhost:8000
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