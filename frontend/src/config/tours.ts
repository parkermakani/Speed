/**
 * Tour configuration for Speed Does The World
 *
 * Each tour defines its metadata, styling, and map settings.
 */

export type ThemeName = 'america' | 'africa';

export interface TourConfig {
  id: string;
  name: string;
  slug: string;
  theme: ThemeName;
  hashtag: string;
  defaultQuote: string;
  isComingSoon: boolean;

  // Tour end date (ISO string) - after this date, stop highlighting the last state
  endDate?: string;

  // Map settings
  center: { lat: number; lng: number };
  defaultZoom: number;

  // Bounding box for auto-detection (used to detect which tour when user pans)
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };

  // Assets
  logoUrl: string;
  logoMobileUrl: string;

  // GeoJSON URL for region highlighting (e.g., US states, African countries)
  geoJsonUrl?: string;
}

/**
 * All available tours
 */
export const TOURS: Record<string, TourConfig> = {
  america: {
    id: 'america',
    name: 'Speed Does America',
    slug: 'america',
    theme: 'america',
    hashtag: 'SpeedDoesAmerica',
    defaultQuote: 'Coast to coast!',
    isComingSoon: false,
    // endDate is fetched from API (set in admin dashboard)
    center: { lat: 39.8283, lng: -98.5795 }, // Geographic center of contiguous US
    defaultZoom: 4,
    bounds: {
      north: 50, // Canadian border
      south: 24, // Southern Texas/Florida
      east: -66, // Maine coast
      west: -125, // Pacific coast
    },
    logoUrl: '/assets/Graphics/SpeedDoesAmericaHQ.png',
    logoMobileUrl: '/assets/Graphics/SpeedDoesAmericaMobile.png',
    geoJsonUrl:
      'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json',
  },
  africa: {
    id: 'africa',
    name: 'Speed Does Africa',
    slug: 'africa',
    theme: 'africa',
    hashtag: 'SpeedDoesAfrica',
    defaultQuote: 'The adventure continues...',
    isComingSoon: true,
    center: { lat: 0, lng: 20 }, // Central Africa (near Great Lakes region)
    defaultZoom: 3,
    bounds: {
      north: 37, // Mediterranean coast
      south: -35, // Cape of Good Hope
      east: 52, // Horn of Africa
      west: -18, // West Africa coast
    },
    // Placeholder - user will provide actual logo
    logoUrl: '', // Will use text placeholder
    logoMobileUrl: '', // Will use text placeholder
    geoJsonUrl: undefined, // No GeoJSON for Africa yet
  },
};

/**
 * Ordered list of tour IDs for navigation
 */
export const TOUR_ORDER: string[] = ['america', 'africa'];

/**
 * Get tour config by index with wrapping for infinite cycling
 */
export function getTourByIndex(index: number): TourConfig {
  const len = TOUR_ORDER.length;
  const wrappedIndex = ((index % len) + len) % len;
  return TOURS[TOUR_ORDER[wrappedIndex]];
}

/**
 * Get the next tour (for right chevron)
 */
export function getNextTour(currentId: string): TourConfig {
  const currentIndex = TOUR_ORDER.indexOf(currentId);
  return getTourByIndex(currentIndex + 1);
}

/**
 * Get the previous tour (for left chevron)
 */
export function getPrevTour(currentId: string): TourConfig {
  const currentIndex = TOUR_ORDER.indexOf(currentId);
  return getTourByIndex(currentIndex - 1);
}

/**
 * Detect which tour a map coordinate belongs to based on bounding boxes
 * Returns null if coordinate doesn't match any tour's bounds
 */
export function detectTourByCoordinates(
  lat: number,
  lng: number
): string | null {
  for (const tourId of TOUR_ORDER) {
    const tour = TOURS[tourId];
    const { north, south, east, west } = tour.bounds;
    if (lat <= north && lat >= south && lng >= west && lng <= east) {
      return tourId;
    }
  }
  return null;
}

/**
 * Get all tours as an array ordered by displayOrder
 */
export function getAllTours(): TourConfig[] {
  return TOUR_ORDER.map((id) => TOURS[id]);
}
