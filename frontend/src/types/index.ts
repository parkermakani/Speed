export interface Status {
  lat: number;
  lng: number;
  state?: string | null;
  quote: string;
  city?: string | null;
  cityPolygon?: string | null; // GeoJSON string
  lastUpdated: string;
}

export interface StatusUpdate {
  lat: number;
  lng: number;
  state?: string | null;
  quote: string;
  city?: string | null;
  cityPolygon?: string | null;
}

export interface City {
  id: number;
  city: string;
  state: string;
  lat: number;
  lng: number;
  order: number;
  is_current: boolean;
}

export interface JourneyCity {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

export interface JourneyResponse {
  currentCity: JourneyCity | null;
  path: JourneyCity[];
}

export interface SleepResponse {
  isSleep: boolean;
}
