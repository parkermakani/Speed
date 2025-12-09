import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import {
  TOURS,
  TOUR_ORDER,
  detectTourByCoordinates,
} from '../config/tours';
import type { TourConfig } from '../config/tours';
import { fetchTours } from '../services/api';
import type { Tour } from '../services/api';

interface TourContextType {
  /** Current active tour configuration */
  activeTour: TourConfig;
  /** Current tour index in TOUR_ORDER */
  tourIndex: number;
  /** Set tour by its ID */
  setTourById: (id: string) => void;
  /** Navigate to next tour (infinite cycling) */
  nextTour: () => void;
  /** Navigate to previous tour (infinite cycling) */
  prevTour: () => void;
  /** Whether auto-detection based on map viewport is enabled */
  autoDetectEnabled: boolean;
  /** Enable/disable auto-detection */
  setAutoDetectEnabled: (enabled: boolean) => void;
  /** Check coordinates and switch tour if in a different region */
  checkAndSwitchTour: (lat: number, lng: number) => void;
  /** Whether the tour is currently transitioning (for animation purposes) */
  isTransitioning: boolean;
}

const TourContext = createContext<TourContextType | null>(null);

interface TourProviderProps {
  children: React.ReactNode;
  /** Initial tour ID (defaults to 'america') */
  initialTourId?: string;
}

export function TourProvider({
  children,
  initialTourId = 'america',
}: TourProviderProps) {
  const initialIndex = Math.max(0, TOUR_ORDER.indexOf(initialTourId));
  const [tourIndex, setTourIndex] = useState(initialIndex);
  const [autoDetectEnabled, setAutoDetectEnabled] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Store dynamic tour data from API (e.g., endDate)
  const [apiTourData, setApiTourData] = useState<Record<string, Tour>>({});

  // Fetch tour data from API on mount to get dynamic fields like endDate
  useEffect(() => {
    fetchTours()
      .then((tours) => {
        const tourMap: Record<string, Tour> = {};
        for (const t of tours) {
          tourMap[t.id] = t;
        }
        setApiTourData(tourMap);
      })
      .catch((e) => {
        console.error('Failed to fetch tours from API:', e);
      });
  }, []);

  // Merge static config with dynamic API data (endDate, etc.)
  const activeTour = useMemo(() => {
    const staticConfig = TOURS[TOUR_ORDER[tourIndex]];
    const apiData = apiTourData[staticConfig.id];
    if (apiData?.endDate) {
      return { ...staticConfig, endDate: apiData.endDate };
    }
    return staticConfig;
  }, [tourIndex, apiTourData]);

  // Apply theme to document when tour changes
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTour.theme);
  }, [activeTour.theme]);

  // Handle tour transition animation
  const transitionToTour = useCallback((newIndex: number) => {
    setIsTransitioning(true);
    setTourIndex(newIndex);
    // Reset transitioning state after animation
    setTimeout(() => setIsTransitioning(false), 500);
  }, []);

  const setTourById = useCallback(
    (id: string) => {
      const idx = TOUR_ORDER.indexOf(id);
      if (idx >= 0 && idx !== tourIndex) {
        transitionToTour(idx);
      }
    },
    [tourIndex, transitionToTour]
  );

  const nextTour = useCallback(() => {
    const newIndex = (tourIndex + 1) % TOUR_ORDER.length;
    transitionToTour(newIndex);
  }, [tourIndex, transitionToTour]);

  const prevTour = useCallback(() => {
    const newIndex = (tourIndex - 1 + TOUR_ORDER.length) % TOUR_ORDER.length;
    transitionToTour(newIndex);
  }, [tourIndex, transitionToTour]);

  const checkAndSwitchTour = useCallback(
    (lat: number, lng: number) => {
      if (!autoDetectEnabled) return;
      const detectedTourId = detectTourByCoordinates(lat, lng);
      if (detectedTourId && detectedTourId !== activeTour.id) {
        setTourById(detectedTourId);
      }
    },
    [autoDetectEnabled, activeTour.id, setTourById]
  );

  const value = useMemo(
    () => ({
      activeTour,
      tourIndex,
      setTourById,
      nextTour,
      prevTour,
      autoDetectEnabled,
      setAutoDetectEnabled,
      checkAndSwitchTour,
      isTransitioning,
    }),
    [
      activeTour,
      tourIndex,
      setTourById,
      nextTour,
      prevTour,
      autoDetectEnabled,
      checkAndSwitchTour,
      isTransitioning,
    ]
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

/**
 * Hook to access tour context
 * Must be used within a TourProvider
 */
export function useTour(): TourContextType {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
