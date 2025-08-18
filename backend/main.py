from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from datetime import datetime, timedelta
from typing import Optional, List
import httpx
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from models import Status, StatusCreate, StatusResponse
from database import create_db_and_tables, get_session
from auth import (
    LoginRequest, TokenResponse, create_access_token, 
    verify_admin_password, get_current_admin, JWT_EXPIRE_MINUTES
)

app = FastAPI(title="Speed Live Map API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Initialize database on startup"""
    create_db_and_tables()
    
    # Create initial status if none exists
    from database import engine
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
                last_updated=datetime.now(),
            )
            session.add(initial_status)
            session.commit()


@app.get("/status", response_model=StatusResponse)
async def get_status(session: Session = Depends(get_session)):
    """Get current location and quote status"""
    try:
        status = session.exec(select(Status)).first()
        if not status:
            raise HTTPException(status_code=404, detail="No status found")
        
        return StatusResponse.from_status(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/status", response_model=StatusResponse)
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


@app.post("/auth/login", response_model=TokenResponse)
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


@app.post("/auth/logout")
async def logout():
    """Admin logout endpoint (client-side token removal)"""
    return {"message": "Successfully logged out"}


@app.get("/places/search")
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


@app.get("/")
async def root():
    """API health check"""
    return {
        "message": "Speed Live Map API",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)