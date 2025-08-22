from fastapi import FastAPI, HTTPException, Depends, Query, APIRouter
import asyncio
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, SQLModel
from datetime import datetime, timedelta
from typing import Optional, List
import httpx
import os
from dotenv import load_dotenv
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Load environment variables from .env file
load_dotenv()

from backend.models import (
    Status, StatusCreate, StatusResponse,
    City, CityCreate, CityUpdate, CityResponse, JourneyResponse, JourneyCity
)
# firestore data layer
from backend import firestore_repo as repo
# Keep database import for other endpoints until fully migrated
from backend.database import create_db_and_tables, get_session
from backend.auth import get_current_admin

from backend.scheduler import start_scheduler
from backend.scheduler import reload_settings

# -------------------- Merch Endpoints --------------------


class MerchCreate(SQLModel):
    name: str
    price: str
    imageUrl: str
    url: str | None = None
    active: bool = True
    shirtTexture: str | None = None
    defaultAnimation: str | None = None


class MerchUpdate(SQLModel):
    name: str | None = None
    price: str | None = None
    imageUrl: str | None = None
    url: str | None = None
    active: bool | None = None
    shirtTexture: str | None = None
    defaultAnimation: str | None = None


# (duplicate merch endpoints removed; real ones are defined later after api init)

# -------------------- Helper: geocode city --------------------

async def geocode_city(city: str, state: str | None = None) -> tuple[float, float] | None:
    """Return (lat,lng) for a city using Google Geocoding API. Returns None on failure."""
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        return None
    query = f"{city}, {state}" if state else city
    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {"address": query, "key": api_key}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
            if data.get("results"):
                loc = data["results"][0]["geometry"]["location"]
                return loc["lat"], loc["lng"]
    except Exception:
        return None
    return None


app = FastAPI(title="Speed Live Map API", version="1.0.0")

# API router with /api prefix
api = APIRouter(prefix="/api")

origins = [
    "http://localhost:5173",
    "https://speeddoesamerica.com",
    "https://speeddoesamerica.replit.app",
]

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    """Initialize database on startup"""
    create_db_and_tables()
    
    # Create initial status if none exists
    from backend.database import engine
    from sqlalchemy import inspect, text
    with Session(engine) as session:
        # Schema migration – drop deprecated columns if present and add new ones as needed
        inspector = inspect(session.bind)
        columns = [c["name"] for c in inspector.get_columns("status")]

        # Add new columns if missing
        if "lat" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN lat FLOAT DEFAULT 0"))
        if "lng" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN lng FLOAT DEFAULT 0"))
        if "state" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN state TEXT"))
        if "city" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN city TEXT"))
        if "city_polygon" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN city_polygon TEXT"))
        if "is_sleep" not in columns:
            session.execute(text("ALTER TABLE status ADD COLUMN is_sleep BOOLEAN DEFAULT 0"))

        # Drop deprecated columns (SQLite ≥3.35 supports DROP COLUMN) – only radius now
        for deprecated in ["radius"]:
            if deprecated in columns:
                try:
                    session.execute(text(f"ALTER TABLE status DROP COLUMN {deprecated}"))
                except Exception:
                    # Older SQLite versions don’t support DROP COLUMN; leave the column but ignore.
                    pass
        session.commit()

        # ---- Ensure city table has new columns BEFORE we query City ----
        city_columns = [c["name"] for c in inspector.get_columns("city")]

        def add_city_column(col_name: str, sql_type: str):
            if col_name not in city_columns:
                try:
                    session.execute(text(f"ALTER TABLE city ADD COLUMN {col_name} {sql_type}"))
                    session.commit()
                    city_columns.append(col_name)
                except Exception:
                    pass

        add_city_column("last_current_at", "TIMESTAMP")
        add_city_column("keywords", "TEXT")

        # Refresh inspector after potential alters (only needed for later debug)

        existing_status = session.exec(select(Status)).first()
        if not existing_status:
            initial_status = Status(
                lat=0,
                lng=0,
                state=None,
                quote="Welcome to Speed Live Map! 🗺️",
                city=None,
                city_polygon=None,
                is_sleep=False,
                last_updated=datetime.now(),
            )
            session.add(initial_status)
            session.commit()

        # Ensure default journey cities exist (idempotent)
        seed_cities = [
            ("Miami", "Florida"),
            ("Orlando", "Florida"),
            ("Daytona", "Florida"),
            ("Jacksonville", "Florida"),
            ("Atlanta", "Georgia"),
            ("Greenville", "South Carolina"),
            ("Washington", "D.C."),
            ("Philadelphia", "Pennsylvania"),
            ("New York", "New York"),
            ("Boston", "Massachusetts"),
            ("Pittsburgh", "Pennsylvania"),
            ("Detroit", "Michigan"),
            ("Chicago", "Illinois"),
            ("Cincinnati", "Ohio"),
            ("Nashville", "Tennessee"),
            ("Memphis", "Tennessee"),
            ("New Orleans", "Louisiana"),
            ("Baton Rouge", "Louisiana"),
            ("Houston", "Texas"),
            ("Austin", "Texas"),
            ("Dallas", "Texas"),
            ("Kansas City", "Missouri"),
            ("Denver", "Colorado"),
            ("Keystone", "South Dakota"),
            ("Jackson Hole", "Wyoming"),
            ("Boise", "Idaho"),
            ("Seattle", "Washington"),
            ("Portland", "Oregon"),
            ("Medford", "Oregon"),
            ("San Francisco", "California"),
            ("Lake Tahoe", "California"),
            ("Las Vegas", "Nevada"),
            ("Phoenix", "Arizona"),
            ("Los Angeles", "California"),
        ]

        existing = session.exec(select(City)).all()
        existing_names = {(c.city, c.state) for c in existing}

        # Insert missing cities and fix order numbering
        for idx, (city_name, state_name) in enumerate(seed_cities, start=1):
            if (city_name, state_name) not in existing_names:
                session.add(
                    City(
                        city=city_name,
                        state=state_name,
                        lat=0.0,
                        lng=0.0,
                        order=idx,
                        is_current=False,
                    )
                )
            else:
                # ensure correct order for existing record
                rec = session.exec(
                    select(City).where(City.city == city_name, City.state == state_name)
                ).first()
                if rec.order != idx:
                    rec.order = idx
                    session.add(rec)

        # Ensure at least one current city
        if not session.exec(select(City).where(City.is_current == True)).first():
            first_city = session.exec(select(City).order_by(City.order)).first()
            if first_city:
                first_city.is_current = True
                session.add(first_city)

        session.commit()

    # -------- Geocode any cities still at 0,0 --------
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if api_key:
        missing = session.exec(select(City).where(City.lat == 0, City.lng == 0)).all()
        async def geocode_and_update(c: City):
            coords = await geocode_city(c.city, c.state)
            if coords:
                c.lat, c.lng = coords
                session.add(c)

        await asyncio.gather(*[geocode_and_update(c) for c in missing])
        session.commit()

        # ---- Ensure city table has new columns before querying ----
        city_columns = [c["name"] for c in inspector.get_columns("city")]
        def add_column_if_missing(col_name: str, sql_type: str):
            if col_name not in city_columns:
                try:
                    session.execute(text(f"ALTER TABLE city ADD COLUMN {col_name} {sql_type}"))
                    session.commit()
                except Exception:
                    pass

        add_column_if_missing("last_current_at", "TIMESTAMP")
        add_column_if_missing("keywords", "TEXT")

        # refresh column list after potential migration
        existing = session.exec(select(City)).all()

    # Start background scheduler (social media scraping)
    start_scheduler()


@api.get("/status", response_model=dict)
async def get_status():
    """Fetch current status from Firestore."""
    status = repo.get_status()
    if not status:
        raise HTTPException(status_code=404, detail="Status not found")
    return status


@api.post("/status")
async def update_status(status_data: StatusCreate, current_admin=Depends(get_current_admin)):
    data_dict = status_data.dict(exclude_unset=True)
    updated = repo.update_status(data_dict)
    return updated


# Deprecated custom login/logout endpoints (handled by Firebase Auth on the client)


@api.get("/places/search")
async def search_places(query: str = Query(..., min_length=1)):
    """Search places using Google Places API (proxy endpoint)"""
    try:
        # Get Google Places API key from environment
        google_api_key = os.getenv("GOOGLE_PLACES_API_KEY")
        print(f"API Key found: {bool(google_api_key)}")
        print(f"Search query: {query}")
        
        if not google_api_key:
            raise HTTPException(status_code=500, detail="Google Places API key not configured")
        
        async with httpx.AsyncClient() as client:
            # Step 1: Get autocomplete suggestions
            autocomplete_url = "https://maps.googleapis.com/maps/api/place/autocomplete/json"
            autocomplete_params = {
                "input": query,
                "key": google_api_key,
                # Remove invalid types parameter or use valid ones like 'establishment', 'geocode', etc.
            }
            
            autocomplete_response = await client.get(autocomplete_url, params=autocomplete_params)
            print(f"Autocomplete status: {autocomplete_response.status_code}")
            autocomplete_response.raise_for_status()
            autocomplete_data = autocomplete_response.json()
            print(f"Autocomplete response: {autocomplete_data}")
            
            if not autocomplete_data.get("predictions"):
                print("No predictions found")
                return {"suggestions": []}
            
            # Step 2: Get details for each prediction to get coordinates
            suggestions = []
            for prediction in autocomplete_data["predictions"][:5]:  # Limit to 5 results
                place_id = prediction["place_id"]
                
                details_url = "https://maps.googleapis.com/maps/api/place/details/json"
                details_params = {
                    "place_id": place_id,
                    "fields": "geometry,name,formatted_address",
                    "key": google_api_key
                }
                
                details_response = await client.get(details_url, params=details_params)
                details_response.raise_for_status()
                details_data = details_response.json()
                
                if details_data.get("result") and details_data["result"].get("geometry"):
                    geometry = details_data["result"]["geometry"]["location"]
                    
                    suggestion = {
                        "place_id": place_id,
                        "description": prediction["description"],
                        "structured_formatting": prediction.get("structured_formatting", {}),
                        "formatted_address": details_data["result"].get("formatted_address"),
                        "geometry": {
                            "location": {
                                "lat": geometry["lat"],
                                "lng": geometry["lng"]
                            }
                        }
                    }
                    suggestions.append(suggestion)
            
            return {"suggestions": suggestions}
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=500, detail=f"Google API error: {e.response.status_code}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search places: {str(e)}")


# Health check under API prefix so root can serve frontend
@api.get("/health")
async def health_check():
    return {
        "message": "Speed Live Map API",
        "version": "1.0.0",
        "status": "running"
    }

# -------------------- City & Journey Endpoints --------------------


@api.get("/cities")
async def list_cities():
    docs = repo.list_cities()
    result = []
    for d in docs:
        if not d.get("city"):
            continue
        result.append({
            "id": d["id"],
            "city": d["city"],
            "state": d.get("state", ""),
            "lat": d.get("lat", 0.0),
            "lng": d.get("lng", 0.0),
            "order": d.get("order", 0),
            "is_current": d.get("isCurrent", False),
        })
    return result


@api.put("/cities/{city_id}", response_model=CityResponse)
async def update_city(
    city_id: int,
    city_update: CityUpdate,
    current_admin=Depends(get_current_admin),
):
    data = city_update.dict(exclude_unset=True)

    # If is_current set true, ensure we unset others in Firestore
    now_iso = datetime.utcnow().isoformat()
    if data.get("is_current") is True:
        cities = repo.list_cities()
        for c in cities:
            if c["id"] != city_id and c.get("isCurrent"):
                repo.update_city(c["id"], {"isCurrent": False})

        # Add timestamp for the newly current city
        data["last_current_at"] = now_iso

    payload = {
        "city": data.get("city"),
        "state": data.get("state"),
        "lat": data.get("lat"),
        "lng": data.get("lng"),
        "order": data.get("order"),
        "isCurrent": data.get("is_current"),
        "lastCurrentAt": data.get("last_current_at"),
        "keywords": data.get("keywords"),
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    updated_doc = repo.update_city(city_id, payload)

    return {
        "id": city_id,
        "city": updated_doc["city"],
        "state": updated_doc.get("state", ""),
        "lat": updated_doc.get("lat", 0.0),
        "lng": updated_doc.get("lng", 0.0),
        "order": updated_doc.get("order", 0),
        "is_current": updated_doc.get("isCurrent", False),
        "lastCurrentAt": updated_doc.get("lastCurrentAt"),
        "keywords": updated_doc.get("keywords"),
    }

    # If now current, also patch status doc
    if updated.is_current:
        repo.update_status({
            "city": updated.city,
            "state": updated.state,
            "lat": updated.lat,
            "lng": updated.lng,
        })

    return updated


@api.get("/journey")
async def get_journey():
    return repo.compute_journey()

# -------------------- Sleep mode endpoints --------------------


@api.get("/sleep")
async def get_sleep():
    return {"isSleep": repo.get_sleep_flag()}


class SleepToggle(SQLModel):
    isSleep: bool


@api.put("/sleep")
async def toggle_sleep(payload: SleepToggle, current_admin=Depends(get_current_admin)):
    flag = repo.set_sleep_flag(payload.isSleep)
    return {"isSleep": flag}


# --- Mount static files LAST so API routes take precedence ---

# -------------------- Merch endpoints --------------------


class MerchCreate(SQLModel):
    name: str
    price: str
    imageUrl: str
    url: str | None = None
    active: bool = True
    shirtTexture: str | None = None
    defaultAnimation: str | None = None


class MerchUpdate(SQLModel):
    name: str | None = None
    price: str | None = None
    imageUrl: str | None = None
    url: str | None = None
    active: bool | None = None
    shirtTexture: str | None = None
    defaultAnimation: str | None = None


@api.get("/merch")
async def list_merch():
    return repo.list_merch()


@api.post("/merch")
async def create_merch(item: MerchCreate, current_admin=Depends(get_current_admin)):
    data = item.dict(exclude_unset=True)
    created = repo.create_merch(data)
    return created


@api.put("/merch/{item_id}")
async def modify_merch(item_id: str, payload: MerchUpdate, current_admin=Depends(get_current_admin)):
    data = payload.dict(exclude_unset=True)
    updated = repo.update_merch(item_id, data)
    return updated


@api.get("/cities/{city_id}/posts")
async def get_city_posts(city_id: int):
    """Return saved social posts for the specified city (public)."""
    posts = repo.list_city_posts(city_id)
    # Sort by likeCount/likes desc then timestamp desc
    def score(p: dict[str, any]):
        return p.get("likeCount", p.get("likes", 0))

    posts.sort(key=score, reverse=True)
    return posts


@api.post("/cities/{city_id}/scrape")
async def manual_scrape(city_id: int, current_admin=Depends(get_current_admin)):
    """Trigger social scrape for a specific city and return number of posts saved."""
    from backend.social_scraper import scrape_city_posts
    city_doc = repo.get_city(city_id)
    if not city_doc:
        raise HTTPException(status_code=404, detail="City not found")
    posts = scrape_city_posts(city_doc)
    if posts:
        repo.save_city_posts(city_id, posts)
    return {"saved": len(posts)}


# -------------------- Settings endpoints --------------------


@api.get("/settings")
async def get_settings():
    return repo.get_settings()


class SettingsUpdate(SQLModel):
    socialScrapeIntervalMin: int | None = None
    instagramUsername: str | None = None
    twitterUsername: str | None = None
    tiktokUsername: str | None = None
    twitchUsername: str | None = None
    youtubeUsername: str | None = None


@api.put("/settings")
async def update_settings(payload: SettingsUpdate, current_admin=Depends(get_current_admin)):
    data = {k: v for k, v in payload.dict().items() if v is not None}
    updated = repo.update_settings(data)
    reload_settings()
    return updated

# --------------------------------------------------------------------
# Register API routes and mount frontend SPA

app.include_router(api)

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

if os.path.isdir(frontend_dist):
    # Mount at root so non-API paths serve the built frontend
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

    # Fallback: serve index.html for unknown non-API routes (client-side routing)
    index_path = os.path.join(frontend_dist, "index.html")

    @app.exception_handler(404)
    async def spa_404_handler(request, exc):
        if request.url.path.startswith("/api"):
            return exc  # Propagate JSON 404 for API routes
        return FileResponse(index_path)

# --------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)