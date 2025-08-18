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
