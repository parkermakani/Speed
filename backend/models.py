from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional


class StatusBase(SQLModel):
    lat: float = Field(ge=-90, le=90, description="Latitude of city centre")
    lng: float = Field(ge=-180, le=180, description="Longitude of city centre")
    state: Optional[str] = Field(default=None, description="State/Province name")

    quote: str = Field(min_length=1, max_length=500, description="Quote text (1-500 characters)")
    city: Optional[str] = Field(default=None, description="Selected city name")
    city_polygon: Optional[str] = Field(default=None, description="GeoJSON string for city limits polygon")


class Status(StatusBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    last_updated: datetime = Field(default_factory=datetime.now)


class StatusCreate(StatusBase):
    city: Optional[str] = None
    city_polygon: Optional[str] = None


class StatusResponse(StatusBase):
    city: Optional[str] = None
    city_polygon: Optional[str] = None
    lastUpdated: datetime

    @classmethod
    def from_status(cls, status: "Status"):
        return cls(
            lat=status.lat,
            lng=status.lng,
            state=status.state,
            quote=status.quote,
            city=status.city,
            city_polygon=status.city_polygon,
            lastUpdated=status.last_updated,
        )