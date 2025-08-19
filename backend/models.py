from sqlmodel import SQLModel, Field
from datetime import datetime
from typing import Optional
from typing import List


class StatusBase(SQLModel):
    lat: float = Field(ge=-90, le=90, description="Latitude of city centre")
    lng: float = Field(ge=-180, le=180, description="Longitude of city centre")
    state: Optional[str] = Field(default=None, description="State/Province name")

    quote: str = Field(min_length=1, max_length=500, description="Quote text (1-500 characters)")
    city: Optional[str] = Field(default=None, description="Selected city name")
    city_polygon: Optional[str] = Field(default=None, description="GeoJSON string for city limits polygon")

    is_sleep: bool = Field(default=False, description="Whether the site is in sleep mode")


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
            is_sleep=status.is_sleep,
        )


# -------------------- City Models --------------------


class CityBase(SQLModel):
    city: str = Field(max_length=100)
    state: str = Field(max_length=100)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    order: int = Field(ge=0, description="Sequence order along the journey")
    is_current: bool = Field(default=False, description="Whether this is the current city")


class City(CityBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)


class CityCreate(CityBase):
    pass


class CityUpdate(SQLModel):
    city: Optional[str] = None
    state: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    order: Optional[int] = None
    is_current: Optional[bool] = None


class CityResponse(CityBase):
    id: int

    @classmethod
    def from_city(cls, city: "City"):
        return cls(
            id=city.id,
            city=city.city,
            state=city.state,
            lat=city.lat,
            lng=city.lng,
            order=city.order,
            is_current=city.is_current,
        )


# -------------------- Journey Response --------------------


class JourneyCity(SQLModel):
    city: str
    state: str
    lat: float
    lng: float


class JourneyResponse(SQLModel):
    currentCity: Optional[JourneyCity]
    path: List[JourneyCity] = []