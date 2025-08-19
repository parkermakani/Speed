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

# Load environment variables from .env file
load_dotenv()

from backend.models import (
    Status, StatusCreate, StatusResponse,
    City, CityCreate, CityUpdate, CityResponse, JourneyResponse, JourneyCity
)
from backend.database import create_db_and_tables, get_session
from backend.auth import (
    LoginRequest, TokenResponse, create_access_token, 
    verify_admin_password, get_current_admin, JWT_EXPIRE_MINUTES
)

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

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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


@api.get("/status", response_model=StatusResponse)
async def get_status(session: Session = Depends(get_session)):
    """Get current location and quote status"""
    try:
        status = session.exec(select(Status)).first()
        if not status:
            raise HTTPException(status_code=404, detail="No status found")
        
        return StatusResponse.from_status(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@api.post("/status", response_model=StatusResponse)
async def update_status(
    status_data: StatusCreate,
    session: Session = Depends(get_session),
    current_admin = Depends(get_current_admin)
):
    """Update location and quote status (admin only)"""
    try:
        # Get existing status or create new one
        existing_status = session.exec(select(Status)).first()
        
        if existing_status:
            # Update existing
            existing_status.lat = status_data.lat
            existing_status.lng = status_data.lng
            existing_status.state = status_data.state
            existing_status.quote = status_data.quote
            existing_status.city = status_data.city
            existing_status.city_polygon = status_data.city_polygon
            existing_status.last_updated = datetime.now()
            session.add(existing_status)
        else:
            # Create new
            new_status = Status(
                lat=status_data.lat,
                lng=status_data.lng,
                state=status_data.state,
                quote=status_data.quote,
                city=status_data.city,
                city_polygon=status_data.city_polygon,
                last_updated=datetime.now()
            )
            session.add(new_status)
        
        session.commit()
        
        # Return updated status
        updated_status = session.exec(select(Status)).first()
        return StatusResponse.from_status(updated_status)
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@api.post("/auth/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Admin login endpoint"""
    if not verify_admin_password(login_data.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid password"
        )
    
    access_token_expires = timedelta(minutes=JWT_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": "admin"}, 
        expires_delta=access_token_expires
    )
    
    return TokenResponse(
        access_token=access_token,
        expires_in=JWT_EXPIRE_MINUTES * 60  # Convert to seconds
    )


@api.post("/auth/logout")
async def logout():
    """Admin logout endpoint (client-side token removal)"""
    return {"message": "Successfully logged out"}


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


@api.get("/cities", response_model=list[CityResponse])
async def list_cities(session: Session = Depends(get_session)):
    cities = session.exec(select(City).order_by(City.order)).all()
    return [CityResponse.from_city(c) for c in cities]


@api.put("/cities/{city_id}", response_model=CityResponse)
async def update_city(
    city_id: int,
    city_update: CityUpdate,
    session: Session = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    city = session.get(City, city_id)
    if not city:
        raise HTTPException(status_code=404, detail="City not found")

    # If is_current toggled true, unset others
    if city_update.is_current is True:
        other_cities = session.exec(select(City).where(City.id != city_id, City.is_current == True)).all()
        for other in other_cities:
            other.is_current = False
            session.add(other)

    # Update provided fields
    update_data = city_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(city, key, value)

    session.add(city)
    session.commit()

    # If this city is now current, ensure coordinates & update Status
    if city.is_current:
        # Fetch coords if missing or zero
        if (abs(city.lat) < 0.0001 and abs(city.lng) < 0.0001):
            coords = await geocode_city(city.city, city.state)
            if coords:
                city.lat, city.lng = coords
                session.add(city)
                session.commit()

        status_rec = session.exec(select(Status)).first()
        if status_rec:
            status_rec.city = city.city
            status_rec.state = city.state
            status_rec.lat = city.lat
            status_rec.lng = city.lng
            status_rec.last_updated = datetime.now()
            session.add(status_rec)
            session.commit()

    session.refresh(city)
    return CityResponse.from_city(city)


@api.get("/journey", response_model=JourneyResponse)
async def get_journey(session: Session = Depends(get_session)):
    cities = session.exec(select(City).order_by(City.order)).all()
    if not cities:
        return JourneyResponse(currentCity=None, path=[])

    current = next((c for c in cities if c.is_current), cities[-1])
    path_cities = [c for c in cities if c.order < current.order]

    def to_jc(c: City):
        return JourneyCity(city=c.city, state=c.state, lat=c.lat, lng=c.lng)

    return JourneyResponse(
        currentCity=to_jc(current),
        path=[to_jc(c) for c in path_cities],
    )

# -------------------- Sleep mode endpoints --------------------


@api.get("/sleep")
async def get_sleep(session: Session = Depends(get_session)):
    status_rec = session.exec(select(Status)).first()
    return {"isSleep": bool(status_rec.is_sleep) if status_rec else False}


class SleepToggle(SQLModel):
    isSleep: bool


@api.put("/sleep")
async def toggle_sleep(
    payload: SleepToggle,
    session: Session = Depends(get_session),
    current_admin = Depends(get_current_admin),
):
    status_rec = session.exec(select(Status)).first()
    if not status_rec:
        raise HTTPException(status_code=404, detail="Status missing")
    status_rec.is_sleep = payload.isSleep
    session.add(status_rec)
    session.commit()
    return {"isSleep": status_rec.is_sleep}


# --- Mount static files LAST so API routes take precedence ---
app.include_router(api)
if os.getenv("ENV") == "production":
    frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
    if os.path.isdir(frontend_dist):
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)