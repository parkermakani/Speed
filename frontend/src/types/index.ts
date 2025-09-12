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
  keywords?: string | null;
  lastCurrentAt?: string | null;
  locatorIconUrl?: string | null; // preferred field name
  locatorPng?: string | null; // legacy/alias from Firestore
}

export interface JourneyCity {
  city: string;
  state: string;
  lat: number;
  lng: number;
  lastCurrentAt?: string; // ISO timestamp for start time
}

export interface JourneyResponse {
  currentCity: JourneyCity | null;
  path: JourneyCity[];
  nextCity?: JourneyCity | null;
}

export interface SleepResponse {
  isSleep: boolean;
  isTraveling?: boolean;
}

export interface Settings {
  socialScrapeIntervalMin: number;
  instagramUsername: string;
  twitterUsername: string;
  tiktokUsername: string;
  twitchUsername: string;
  youtubeUsername: string;
  socialHashtag?: string;
  curatorApiBase?: string;
  curatorApiKey?: string;
  curatorFeedId?: string;
  curatorJsonUrl?: string;
  disableMerch?: boolean;
  sleepHideUserBar?: boolean;
  departureTime?: string; // HH:MM UTC
  departureTimezone?: string; // IANA TZ, e.g., America/New_York
}

// Tip system types
export type SelectorOrRef = string | React.RefObject<HTMLElement>;
export type TipContinueMode =
  | "tapAnywhere" // user can tap/click anywhere to advance
  | "clickTarget" // must click the highlighted target (e.g., open drawer)
  | "waitCondition"; // advance when waitCondition() becomes true
export interface TipStep {
  id: string;
  imageUrl: string;
  target: SelectorOrRef;
  continueMode: TipContinueMode;
  waitCondition?: () => boolean;
  // Per-breakpoint placement controls
  placementDesktop?: {
    offsetX: number; // px relative to chosen anchor on target rect
    offsetY: number; // px relative to chosen anchor on target rect
    rotationDeg?: number; // optional rotation for the tip image
    anchor?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center";
    /** Optional scale multiplier for desktop (1 = 100%). */
    scale?: number;
  };
  placementMobile?: {
    offsetX: number;
    offsetY: number;
    rotationDeg?: number;
    anchor?: "topLeft" | "topRight" | "bottomLeft" | "bottomRight" | "center";
    /** Optional scale multiplier for mobile (1 = 100%). */
    scale?: number;
  };
}
