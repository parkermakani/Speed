import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AnimatedMotorcycle from "./AnimatedMotorcycle";
import AnimatedSleeping from "./AnimatedSleeping";
import ReactDOM from "react-dom/client";
// Quote overlay removed; quote will be rendered at page level

import type { JourneyCity } from "../types";
import { CityPopup } from "./CityPopup";
import { Drawer } from "./primitives/Drawer";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { useTour } from "../contexts/TourContext";
import { TOURS } from "../config/tours";

// GeoJSON URL for world countries
const COUNTRIES_GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

// African country names for filtering
const AFRICAN_COUNTRY_NAMES = new Set([
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde',
  'Cameroon', 'Central African Republic', 'Chad', 'Comoros', 'Democratic Republic of the Congo',
  'Republic of the Congo', 'Republic of Congo', "Côte d'Ivoire", "Cote d'Ivoire", 'Ivory Coast',
  'Djibouti', 'Egypt', 'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Swaziland', 'Ethiopia',
  'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia',
  'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique',
  'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Príncipe', 'Sao Tome and Principe',
  'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan',
  'Tanzania', 'United Republic of Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
  'Western Sahara', 'Congo'
]);

// Cache for Africa GeoJSON
let africaGeoJson: any | null = null;
const ensureAfricaGeoJson = async () => {
  if (africaGeoJson) return africaGeoJson;
  try {
    const res = await fetch(COUNTRIES_GEOJSON_URL);
    const allCountries = await res.json();
    // Filter to only African countries
    africaGeoJson = {
      type: 'FeatureCollection',
      features: allCountries.features.filter((f: any) => {
        const name = f.properties?.ADMIN || f.properties?.name || '';
        return AFRICAN_COUNTRY_NAMES.has(name);
      })
    };
    console.log('[Map] Loaded Africa GeoJSON with', africaGeoJson.features.length, 'countries');
    return africaGeoJson;
  } catch (e) {
    console.error('[Map] Failed to load Africa GeoJSON:', e);
    return null;
  }
};

interface FlatMapProps {
  lat: number;
  lng: number;
  state?: string | null;
  path?: { lat: number; lng: number }[];
  pastCities?: { city?: string; state?: string; lat: number; lng: number }[];
  /** Whether the map is in sleep mode; changes marker to sleeping animation */
  isSleep?: boolean;
  /** Whether traveling mode is active during sleep */
  isTraveling?: boolean;
  /** Current city metadata for popup when clicking the animated marker */
  currentCity?: JourneyCity | null;
  /** Next city in the journey (used to determine when current city window ends) */
  nextCity?: JourneyCity | null;
  /** Controls visibility of animated marker (hide before departure) */
  showMarker?: boolean;
  /** Callback when map center changes (for auto-detecting tour) */
  onMapCenterChange?: (lat: number, lng: number) => void;
}

// Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
  console.warn("Please set a valid VITE_MAPBOX_TOKEN in your .env file");
}
mapboxgl.accessToken = MAPBOX_TOKEN || "";

const HIDE = import.meta.env.VITE_HIDE_CITIES === "true";

// Helper to read CSS variable
const getCSSVariable = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// getRandomIcon no longer needed (legacy)

// Free US states geojson (same as 3D version)
const STATES_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";
let statesGeo: any | null = null;
const ensureStates = async () => {
  if (statesGeo) return statesGeo;
  const res = await fetch(STATES_URL);
  statesGeo = await res.json();
  return statesGeo;
};

import React from "react";

function FlatMapInner({
  lat,
  lng,
  state,
  path = [],
  pastCities = [],
  isSleep = false,
  isTraveling = false,
  currentCity = null,
  nextCity = null,
  showMarker = true,
  onMapCenterChange,
}: FlatMapProps) {
  const [selectedCity, setSelectedCity] = useState<JourneyCity | null>(null);
  const isMobile = useMediaQuery("(max-width: 767px)");
  const { activeTour, checkAndSwitchTour } = useTour();
  const initialZoom = isMobile
    ? activeTour.defaultZoom - 1
    : activeTour.defaultZoom;
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const pastMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const markerContainerRef = useRef<HTMLDivElement | null>(null);
  const markerRootRef = useRef<ReturnType<typeof ReactDOM.createRoot> | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);
  // Departing city locator marker during traveling
  const departingMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const departingImgRef = useRef<HTMLImageElement | null>(null);
  // Track previous tour ID to detect changes
  const prevTourIdRef = useRef<string>(activeTour.id);
  // Pulse interval for Africa "coming soon" countries
  const africaPulseRef = useRef<number | null>(null);

  // Determine if we should highlight the current state/country
  // State should NOT be highlighted if we've passed the next city's start time (meaning Speed has left)
  // For the LAST city, use the tour's endDate instead
  const shouldHighlightState = useMemo(() => {
    // If no state provided, nothing to highlight
    if (!state) return false;

    const now = new Date();

    // If there's a next city, use its start time as the end of current city's window
    if (nextCity?.lastCurrentAt) {
      try {
        const nextCityStart = new Date(nextCity.lastCurrentAt);

        // If current time is BEFORE next city's start, Speed is still in current state
        const shouldHighlight = now < nextCityStart;

        console.debug("[StateHighlight] shouldHighlightState decision (has nextCity)", {
          state,
          nextCityStartIso: nextCity.lastCurrentAt,
          nowIso: now.toISOString(),
          shouldHighlight,
        });

        return shouldHighlight;
      } catch {
        // If parsing fails, default to showing highlight
        return true;
      }
    }

    // No next city - this is the LAST city
    // Use the tour's endDate to determine when to stop highlighting
    if (activeTour.endDate) {
      try {
        const tourEndDate = new Date(activeTour.endDate);

        // If current time is BEFORE tour end date, keep highlighting
        const shouldHighlight = now < tourEndDate;

        console.debug("[StateHighlight] shouldHighlightState decision (last city, using tour endDate)", {
          state,
          tourEndDateIso: activeTour.endDate,
          nowIso: now.toISOString(),
          shouldHighlight,
        });

        return shouldHighlight;
      } catch {
        // If parsing fails, default to showing highlight
        return true;
      }
    }

    // No next city and no tour endDate - keep highlighting indefinitely (fallback)
    console.debug("[StateHighlight] shouldHighlightState decision (last city, no endDate)", {
      state,
      shouldHighlight: true,
    });
    return true;
  }, [state, nextCity?.lastCurrentAt, activeTour.endDate]);

  // Safely unmount the React root for the animated marker outside of React's render tick
  const safeUnmountMarkerRoot = () => {
    const root = markerRootRef.current;
    if (root) {
      markerRootRef.current = null;
      setTimeout(() => {
        try {
          root.unmount();
        } catch (e) {
          // no-op; unmount can be called during strict mode double-invoke
        }
      }, 0);
    }
  };

  // Add region highlight layers - works for both US states (America) and countries (Africa)
  const addRegionLayers = async (regionName: string) => {
    if (!mapRef.current) return;
    if (!mapRef.current.isStyleLoaded()) {
      mapRef.current.once("styledata", () => addRegionLayers(regionName));
      return;
    }

    const isAfrica = activeTour.id === 'africa';
    const sourceId = isAfrica ? "africa-countries-src" : "states-geo-src";
    const borderId = isAfrica ? "country-border" : "state-border";
    const highlightId = isAfrica ? "country-highlight" : "state-highlight";
    // Property name differs: US states use "name", Africa GeoJSON uses "ADMIN"
    const propertyName = isAfrica ? "ADMIN" : "name";

    // Get fresh color from CSS (important when tour/theme changes)
    const primaryColor = getCSSVariable("--color-primary") || "#B31942";

    // Load appropriate GeoJSON
    const geojson = isAfrica ? await ensureAfricaGeoJson() : await ensureStates();
    if (!geojson) return;

    // Add source if not present
    if (!mapRef.current.getSource(sourceId)) {
      mapRef.current.addSource(sourceId, {
        type: "geojson",
        data: geojson as any,
      });
    }

    // Filter for the selected region
    const regionFilter = ["==", ["get", propertyName], regionName];

    // Clear any previous pulse interval
    // @ts-ignore
    if (mapRef.current._pulseId) clearInterval(mapRef.current._pulseId);

    // Remove old layers from the OTHER tour to avoid color conflicts
    const otherHighlightId = isAfrica ? "state-highlight" : "country-highlight";
    const otherBorderId = isAfrica ? "state-border" : "country-border";
    if (mapRef.current.getLayer(otherHighlightId)) {
      mapRef.current.removeLayer(otherHighlightId);
    }
    if (mapRef.current.getLayer(otherBorderId)) {
      mapRef.current.removeLayer(otherBorderId);
    }

    // Remove and recreate current tour layers to ensure fresh colors
    if (mapRef.current.getLayer(highlightId)) {
      mapRef.current.removeLayer(highlightId);
    }
    if (mapRef.current.getLayer(borderId)) {
      mapRef.current.removeLayer(borderId);
    }

    // Create highlight layer with fresh color
    mapRef.current.addLayer({
      id: highlightId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": primaryColor,
        "fill-opacity": 0.2,
      },
      filter: regionFilter,
    });

    // Pulse animation
    let up = true;
    // @ts-ignore
    mapRef.current._pulseId = setInterval(() => {
      const m = mapRef.current;
      if (!m) return;
      const hasLayer = m.getLayer && m.getLayer(highlightId);
      if (hasLayer) {
        m.setPaintProperty(highlightId, "fill-opacity", up ? 0.35 : 0.15);
        up = !up;
      }
    }, 1000);

    // Create border layer with fresh color
    mapRef.current.addLayer({
      id: borderId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": primaryColor,
        "line-width": 3,
      },
      filter: regionFilter,
    });
  };

  // Add base color layer for all African countries (pulses when "coming soon")
  const addAfricaBaseLayers = async () => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = 'africa-countries-src';
    const layerId = 'africa-countries-base';
    const usaTanColor = getCSSVariable('--color-land') || '#DEC29B'; // USA tan (active/highlighted)
    const defaultTanColor = '#C4B59A'; // Darker tan (what all non-US countries have in the base style)

    // Clear any existing pulse interval for base layer
    if (africaPulseRef.current) {
      clearInterval(africaPulseRef.current);
      africaPulseRef.current = null;
    }

    // Remove existing layer if present
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    // Load Africa GeoJSON
    const africaGeo = await ensureAfricaGeoJson();
    if (!africaGeo) {
      console.warn('[Map] Could not load Africa GeoJSON');
      return;
    }

    // Add or update source
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, {
        type: 'geojson',
        data: africaGeo,
      });
    }

    // Find the first non-background layer to insert our fill behind everything
    const layers = map.getStyle()?.layers || [];
    let firstLayerId: string | undefined;
    for (const layer of layers) {
      if ((layer as any).type !== 'background') {
        firstLayerId = (layer as any).id;
        break;
      }
    }

    // Add fill layer for African countries at the bottom of the layer stack
    try {
      map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
          'fill-color': TOURS.africa.isComingSoon ? defaultTanColor : usaTanColor,
          'fill-opacity': 1,
        },
      }, firstLayerId); // Insert at the bottom (before the first non-background layer)
      console.log('[Map] Added Africa base layer at bottom, before:', firstLayerId);
    } catch (e1) {
      console.error('[Map] Failed to add Africa base layer:', e1);
    }

    // If Africa is "coming soon", pulse all countries between darker tan and USA tan
    if (TOURS.africa.isComingSoon && map.getLayer(layerId)) {
      let showHighlighted = false;
      africaPulseRef.current = window.setInterval(() => {
        if (!map.getLayer(layerId)) return;
        const color = showHighlighted ? usaTanColor : defaultTanColor;
        map.setPaintProperty(layerId, 'fill-color', color);
        showHighlighted = !showHighlighted;
      }, 800);
    }
  };

  const addMarker = () => {
    const map = mapRef.current;
    if (!map) return;

    // Remove existing marker so we can recreate it when sleep state changes
    if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    safeUnmountMarkerRoot();
    markerContainerRef.current = null;

    const create = () => {
      const container = document.createElement("div");
      // Allow clicks on marker
      container.style.pointerEvents = "auto";
      container.style.cursor = "pointer";
      // Hint browsers to allow gestures like pinch-zoom to pass through
      // without delay while still enabling taps on the marker
      // Safari/iOS will ignore unsupported values gracefully
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - CSSStyleDeclaration doesn't include all possible values
      container.style.touchAction = "manipulation";
      // Ensure animated marker sits above city locator icons
      container.style.zIndex = "200";
      // Prevent map click handler from closing popup immediately
      try {
        container.addEventListener("click", (e) => e.stopPropagation());
        container.addEventListener("mousedown", (e) => e.stopPropagation());
        // Allow multi-touch (pinch-zoom) to reach the map; only stop single taps
        container.addEventListener(
          "touchstart",
          (e) => {
            const te = e as TouchEvent;
            if (te.touches && te.touches.length > 1) return; // let pinch-zoom through
            e.stopPropagation();
          },
          { passive: true }
        );
      } catch {}

      // Tip target: current city marker
      try {
        container.setAttribute("data-tip-target", "current-city");
      } catch {}

      // Mount React component inside container
      const MarkerComponent = isSleep ? AnimatedSleeping : AnimatedMotorcycle;
      const zoom = map.getZoom();
      const baseAwake = 300;
      const baseSleep = 220;
      const getMarkerSizeForZoom = (z: number) => {
        const minZoom = 3;
        const maxZoom = 8;
        const t = Math.max(0, Math.min(1, (z - minZoom) / (maxZoom - minZoom)));
        if (isSleep) {
          const minSize = 160;
          const maxSize = 240;
          return Math.round(minSize + (maxSize - minSize) * t);
        }
        const minSize = 220;
        const maxSize = 340;
        return Math.round(minSize + (maxSize - minSize) * t);
      };
      const size = getMarkerSizeForZoom(zoom);
      const scale = size / (isSleep ? baseSleep : baseAwake);
      const clickWidth = Math.round((isSleep ? 200 : 120) * scale);
      const clickHeight = Math.round(140 * scale);
      const clickOffsetX = Math.round((isSleep ? 0 : 150) * scale);
      const clickOffsetY = Math.round((isSleep ? 60 : 80) * scale);

      const root = ReactDOM.createRoot(container);
      root.render(
        <MarkerComponent
          size={size}
          showBorder={false}
          clickWidth={clickWidth}
          clickHeight={clickHeight}
          clickOffsetX={clickOffsetX}
          clickOffsetY={clickOffsetY}
          showClickBorder={false}
          onClick={() =>
            setSelectedCity({
              city: currentCity?.city ?? "Unknown",
              state: currentCity?.state ?? (state || ""),
              lat,
              lng,
            })
          }
        />
      );
      markerRootRef.current = root;
      markerContainerRef.current = container;

      markerRef.current = new mapboxgl.Marker({
        element: container,
        anchor: "center",
        offset: [
          Math.round(-50 * (size / baseAwake)),
          Math.round(-45 * (size / baseAwake)),
        ],
      })
        .setLngLat([lng, lat])
        .addTo(map);
    };
    // Markers do not depend on style state; create immediately to avoid queued duplicates
    create();
  };

  // Update the animated marker size and offsets on zoom
  const updateMarkerSize = () => {
    const map = mapRef.current;
    if (
      !map ||
      !markerRef.current ||
      !markerContainerRef.current ||
      !markerRootRef.current
    )
      return;
    const zoom = map.getZoom();
    const baseAwake = 300;
    const baseSleep = 220;
    const minZoom = 3;
    const maxZoom = 8;
    const t = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
    const size = Math.round(
      (isSleep ? 160 : 220) +
        ((isSleep ? 240 : 340) - (isSleep ? 160 : 220)) * t
    );
    const scale = size / (isSleep ? baseSleep : baseAwake);
    const clickWidth = Math.round((isSleep ? 200 : 120) * scale);
    const clickHeight = Math.round(140 * scale);
    const clickOffsetX = Math.round((isSleep ? 0 : 150) * scale);
    const clickOffsetY = Math.round((isSleep ? 60 : 80) * scale);

    const MarkerComponent = isSleep ? AnimatedSleeping : AnimatedMotorcycle;
    markerRootRef.current.render(
      <MarkerComponent
        size={size}
        showBorder={false}
        clickWidth={clickWidth}
        clickHeight={clickHeight}
        clickOffsetX={clickOffsetX}
        clickOffsetY={clickOffsetY}
        showClickBorder={false}
        onClick={() =>
          setSelectedCity({
            city: currentCity?.city ?? "Unknown",
            state: currentCity?.state ?? (state || ""),
            lat,
            lng,
          })
        }
      />
    );

    markerRef.current.setOffset([
      Math.round(-50 * (size / baseAwake)),
      Math.round(-45 * (size / baseAwake)),
    ] as any);
  };

  const drawPath = () => {
    const map = mapRef.current;
    if (!map || path.length < 2) return;

    // Ensure style is loaded
    if (!map.isStyleLoaded()) {
      map.once("styledata", drawPath);
      return;
    }

    const sourceId = "journey-src";
    const layerId = "journey-path";

    // Get fresh color from CSS (important when tour/theme changes)
    const primaryColor = getCSSVariable("--color-primary") || "#B31942";

    const coordinates = path
      .map((p) => [p.lng, p.lat])
      .filter((c) => !isNaN(c[0]) && !isNaN(c[1]));

    if (coordinates.length < 2) return;

    const geojson = {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates,
      },
    } as const;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data: geojson as any });
    } else {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(
        geojson as any
      );
    }

    // Remove and recreate layer to ensure fresh color when tour changes
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (path.length > 0) {
      map.addLayer({
        id: layerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": primaryColor,
          "line-width": 4,
          "line-dasharray": [2, 1],
        },
      });
    }
  };

  // --------------- Past city markers ---------------
  const allIcons: string[] = Object.values(
    import.meta.glob("../assets/LocIcons/*.png", {
      eager: true,
      import: "default",
      query: "?url",
    })
  ) as string[];

  // Mobile zoom threshold: below this zoom level, show dots instead of icons
  const MOBILE_DOT_ZOOM_THRESHOLD = 3;
  const DOT_SIZE = 12; // Size of simple dot markers

  // Track whether we're currently showing dots (for mobile zoom-out)
  const showingDotsRef = useRef<boolean>(false);
  // Store city data with markers for re-rendering
  const pastCitiesDataRef = useRef<typeof pastCities>([]);

  // Compute icon size based on current zoom level
  const getIconSizeForZoom = (zoom: number) => {
    const minSize = 40; // smaller when zoomed out
    const maxSize = 70; // larger when zoomed in
    const minZoom = 3;
    const maxZoom = 8;
    const t = Math.max(0, Math.min(1, (zoom - minZoom) / (maxZoom - minZoom)));
    return Math.round(minSize + (maxSize - minSize) * t);
  };

  // Check if we should show dots (mobile + zoomed out)
  const shouldShowDots = (zoom: number) => {
    return isMobile && zoom < MOBILE_DOT_ZOOM_THRESHOLD;
  };

  // Resize all past city icons on zoom (and switch between dots/icons on mobile)
  const updatePastIconSizes = () => {
    const map = mapRef.current;
    if (!map || pastMarkersRef.current.length === 0) return;

    const zoom = map.getZoom();
    const needDots = shouldShowDots(zoom);

    // If we need to switch between dots and icons, re-render markers
    if (needDots !== showingDotsRef.current) {
      renderPastMarkers();
      return;
    }

    // Just resize existing markers
    if (needDots) {
      // Dots stay the same size
      return;
    }

    const size = getIconSizeForZoom(zoom);
    pastMarkersRef.current.forEach((mk) => {
      const el = mk.getElement() as HTMLElement;
      if (el && el.tagName === 'IMG') {
        (el as HTMLImageElement).style.width = `${size}px`;
        (el as HTMLImageElement).style.height = `${size}px`;
      }
    });
    // Also resize departing marker icon if present
    if (departingImgRef.current) {
      const dsize = getIconSizeForZoom(zoom);
      departingImgRef.current.style.width = `${dsize}px`;
      departingImgRef.current.style.height = `${dsize}px`;
    }
  };

  const renderPastMarkers = () => {
    const map = mapRef.current;
    if (!map || pastCities.length === 0) return;

    // Store cities data for potential re-renders
    pastCitiesDataRef.current = pastCities;

    // Clear existing markers
    pastMarkersRef.current.forEach((m) => m.remove());
    pastMarkersRef.current = [];

    const zoom = map.getZoom();
    const useDots = shouldShowDots(zoom);
    showingDotsRef.current = useDots;

    pastCities.forEach((pt) => {
      let element: HTMLElement;

      if (useDots) {
        // Create simple dot element for mobile zoomed-out view
        const dot = document.createElement("div");
        dot.style.width = `${DOT_SIZE}px`;
        dot.style.height = `${DOT_SIZE}px`;
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = getCSSVariable("--color-primary") || "#B31942";
        dot.style.border = "2px solid white";
        dot.style.boxShadow = "0 1px 3px rgba(0,0,0,0.3)";
        dot.style.cursor = "pointer";
        dot.style.pointerEvents = "auto";
        dot.style.zIndex = "80";
        element = dot;
      } else {
        // Create full icon element
        const initialSize = getIconSizeForZoom(zoom);
        const img = document.createElement("img");
        const custom =
          (pt as any).locatorIconUrl || (pt as any).locatorPng || null;
        img.src = custom || allIcons[Math.floor(Math.random() * allIcons.length)];
        img.style.width = `${initialSize}px`;
        img.style.height = `${initialSize}px`;
        img.style.cursor = "pointer";
        img.style.pointerEvents = "auto";
        img.style.zIndex = "80";
        element = img;
      }

      element.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedCity({
          city: (pt as any).city ?? "Unknown",
          state: (pt as any).state ?? "",
          lat: pt.lat,
          lng: pt.lng,
        });
      });

      const mk = new mapboxgl.Marker({ element, anchor: "center" })
        .setLngLat([pt.lng, pt.lat])
        .addTo(map);
      pastMarkersRef.current.push(mk);
    });
  };

  // scaling removed – icons fixed size

  useEffect(() => {
    // Gracefully handle devices/browsers without WebGL support (some mobile browsers)
    if (!mapboxgl.supported()) {
      console.warn("Mapbox GL JS is not supported on this device/browser.");
      setUnsupported(true);
      setLoading(false);
      return;
    }

    if (!containerRef.current) return;

    // Split pan bounds (very large)
    // Pan bounds are large so they don't constrain zoom-out on any device
    const panBounds: [number, number][] = [
      [-180, -85],
      [180, 85],
    ];

    try {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style:
          import.meta.env.VITE_MAPBOX_STYLE ||
          "mapbox://styles/mapbox/light-v11", // sensible fallback
        center: [lng, lat], // start centered on current city
        zoom: initialZoom,
        pitch: 0,
        bearing: 0,
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch (err) {
      console.error("Failed to initialise Mapbox map", err);
      setUnsupported(true);
      setLoading(false);
      return;
    }

    // Immediately constrain view
    // Allow more zoom-out to frame full continents during tour transitions
    mapRef.current.setMinZoom(isMobile ? 2 : 2.5);
    mapRef.current.setMaxBounds(panBounds as any);

    mapRef.current.on("load", () => {
      // ensure we remain centered on current city once style has loaded
      mapRef.current!.jumpTo({ center: [lng, lat], zoom: initialZoom });

      // Add Africa base layer (tan color for all African countries, pulses when "coming soon")
      addAfricaBaseLayers();

      if (!HIDE) {
        // Draw region polygons and highlight current state/country
        // Only highlight if shouldHighlightState is true (we haven't passed the end time)
        addRegionLayers(shouldHighlightState ? (state || "") : "");
        addMarker();
        drawPath();
        renderPastMarkers();
        // Resize icons as user zooms
        mapRef.current!.on("zoom", updatePastIconSizes);
        mapRef.current!.on("zoom", updateMarkerSize);
      }
      mapRef.current!.once("idle", () => setLoading(false));
    });

    // 🆕 Ensure map resizes when its container resizes (fix small corner issue)
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        mapRef.current?.resize();
      });
      resizeObserver.observe(containerRef.current);
    } else {
      // Fallback: slight delay resize after mount
      setTimeout(() => mapRef.current?.resize(), 100);
    }

    return () => {
      resizeObserver?.disconnect();
      // clear pulse interval if present
      // @ts-ignore
      if (mapRef.current?._pulseId) clearInterval(mapRef.current._pulseId);
      // clear Africa pulse interval
      if (africaPulseRef.current) clearInterval(africaPulseRef.current);
      // remove zoom listener
      mapRef.current?.off("zoom", updatePastIconSizes);
      mapRef.current?.off("zoom", updateMarkerSize);
      // unmount animated marker root safely
      safeUnmountMarkerRoot();
      mapRef.current?.remove();
    };
  }, []);

  // Update on prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (HIDE) return;

    // Use requestAnimationFrame to ensure CSS variables have updated after theme change
    // This is necessary because the data-theme attribute change and CSS recomputation
    // might not be complete when this effect runs
    requestAnimationFrame(() => {
      if (!mapRef.current) return;
      addMarker();
      // Only highlight if shouldHighlightState is true (we haven't passed the end time)
      addRegionLayers(shouldHighlightState ? (state || "") : "");
      drawPath();
      renderPastMarkers();
      updatePastIconSizes();
    });
  }, [lat, lng, state, path, pastCities, isSleep, showMarker, activeTour.id, activeTour.theme, shouldHighlightState]);

  // FlyTo when tour changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (prevTourIdRef.current === activeTour.id) return;

    // Tour changed - fit bounds to frame the entire region
    prevTourIdRef.current = activeTour.id;

    // Use fitBounds to frame the entire country/continent
    const { bounds } = activeTour;
    const padding = isMobile ? 40 : 60;

    map.fitBounds(
      [
        [bounds.west, bounds.south], // Southwest corner
        [bounds.east, bounds.north], // Northeast corner
      ],
      {
        padding: { top: padding + 80, bottom: padding + 60, left: padding, right: padding }, // Extra top padding for header
        duration: 2000,
        essential: true,
      }
    );
  }, [activeTour.id, activeTour.bounds, isMobile]);

  // Auto-detect tour based on map center when user pans
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMoveEnd = () => {
      const center = map.getCenter();
      checkAndSwitchTour(center.lat, center.lng);
      onMapCenterChange?.(center.lat, center.lng);
    };

    map.on("moveend", handleMoveEnd);
    return () => {
      map.off("moveend", handleMoveEnd);
    };
  }, [checkAndSwitchTour, onMapCenterChange]);

  // Manage Mapbox Popup on desktop
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedCity && !isMobile) {
      // remove any existing popup
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      const container = document.createElement("div");

      // Decide anchor based on point pixel position
      const point = map.project([selectedCity.lng, selectedCity.lat]);
      const mapHeight = map.getContainer().clientHeight;
      const isTopHalf = point.y < mapHeight / 2;
      const anchor: mapboxgl.Anchor = isTopHalf ? "top" : "bottom";
      const arrowDir = isTopHalf ? "up" : "down";

      ReactDOM.createRoot(container).render(
        <CityPopup
          city={selectedCity}
          onClose={() => setSelectedCity(null)}
          showArrow
          arrowDirection={arrowDir as any}
        />
      );

      const handleMapClick = () => setSelectedCity(null);
      map.on("click", handleMapClick);

      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        offset: 15,
        className: "city-popup",
        anchor,
      })
        .setLngLat([selectedCity.lng, selectedCity.lat])
        .setDOMContent(container)
        .setMaxWidth("800px")
        .addTo(map);

      return () => {
        map.off("click", handleMapClick);
      };
    } else {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    }
  }, [selectedCity, isMobile]);

  // Close popup with Escape key
  useEffect(() => {
    if (!selectedCity) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedCity(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedCity]);

  // Cleanup popup when map unmounts
  useEffect(() => {
    return () => {
      if (popupRef.current) popupRef.current.remove();
    };
  }, []);

  // --------------- Traveling progress (line + departing locator) ---------------
  const drawTravelProgress = () => {
    const map = mapRef.current;
    // Before departure, we still want the animated marker visible but we should hide the departing locator and line until departure.
    if (!map || !isSleep || !isTraveling || !currentCity || !showMarker) {
      // remove progress layer/source if present
      try {
        if (map?.getLayer("travel-progress-line"))
          map.removeLayer("travel-progress-line");
      } catch {}
      try {
        if (map?.getSource("travel-progress-src"))
          map.removeSource("travel-progress-src");
      } catch {}
      // clear pulse interval if present
      try {
        // @ts-ignore
        if ((map as any)._travelPulseId)
          clearInterval((map as any)._travelPulseId);
      } catch {}
      // remove departing marker
      if (departingMarkerRef.current) {
        departingMarkerRef.current.remove();
        departingMarkerRef.current = null;
        departingImgRef.current = null;
      }
      return;
    }

    // Ensure style loaded
    if (!map.isStyleLoaded()) {
      map.once("styledata", drawTravelProgress);
      return;
    }

    const origin = [currentCity.lng, currentCity.lat] as const;
    const current = [lng, lat] as const;
    const coordinates = [origin, current];

    const sourceId = "travel-progress-src";
    const layerId = "travel-progress-line";

    // Get fresh color from CSS (important when tour/theme changes)
    const primaryColor = getCSSVariable("--color-primary") || "#B31942";

    const data = {
      type: "Feature",
      geometry: { type: "LineString", coordinates },
    } as const;

    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: "geojson", data: data as any });
    } else {
      (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data as any);
    }

    // Remove and recreate layer to ensure fresh color when tour changes
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    map.addLayer({
      id: layerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": primaryColor,
        "line-width": 5,
        "line-opacity": 0.85,
        "line-dasharray": [2, 1],
      },
    });
    // Pulse animation for travel progress line
    try {
      // @ts-ignore
      if ((map as any)._travelPulseId)
        clearInterval((map as any)._travelPulseId);
    } catch {}
    let up = true;
    // @ts-ignore
    (map as any)._travelPulseId = setInterval(() => {
      try {
        const m = mapRef.current;
        if (!m || !m.getLayer(layerId)) return;
        m.setPaintProperty(layerId, "line-opacity", up ? 0.35 : 0.9);
        up = !up;
      } catch {}
    }, 900);

    // Render departing locator icon at origin
    if (!departingMarkerRef.current) {
      const img = document.createElement("img");
      const custom =
        (currentCity as any).locatorIconUrl ||
        (currentCity as any).locatorPng ||
        null;
      const initialSize = getIconSizeForZoom(map.getZoom());
      img.src = custom || allIcons[Math.floor(Math.random() * allIcons.length)];
      img.style.width = `${initialSize}px`;
      img.style.height = `${initialSize}px`;
      img.style.cursor = "pointer";
      img.style.pointerEvents = "auto";
      // Keep departing locator below animated marker
      img.style.zIndex = "80";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedCity({
          city: currentCity.city,
          state: currentCity.state,
          lat: currentCity.lat,
          lng: currentCity.lng,
        });
      });
      departingImgRef.current = img;
      departingMarkerRef.current = new mapboxgl.Marker({
        element: img,
        anchor: "center",
      })
        .setLngLat(origin as unknown as [number, number])
        .addTo(map);
    } else {
      departingMarkerRef.current.setLngLat(
        origin as unknown as [number, number]
      );
    }
    try {
      console.debug("[TravelDebug] draw travel progress", {
        origin,
        current,
        lineAdded: true,
        departingIcon: !!departingMarkerRef.current,
      });
    } catch {}
  };

  // Update travel progress on prop changes
  useEffect(() => {
    drawTravelProgress();
  }, [isSleep, isTraveling, currentCity, lat, lng]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
    return (
      <div style={{ padding: "1rem", textAlign: "center" }}>
        Mapbox token missing
      </div>
    );
  }

  if (unsupported) {
    return (
      <div
        style={{
          padding: "1rem",
          textAlign: "center",
          background: "var(--color-surface)",
          color: "var(--color-text-secondary)",
        }}
      >
        <p>
          Interactive map is not supported on this device. Try viewing on a
          desktop browser for the full experience.
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: "70vh" }}
      />
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.6)",
            color: "white",
            fontSize: "1.25rem",
            zIndex: 20,
          }}
        >
          Loading map...
        </div>
      )}
      {/* Coming Soon overlay for tours without cities */}
      {activeTour.isComingSoon && !loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 15,
          }}
        >
          <div
            style={{
              background: "var(--coming-soon-bg, rgba(0, 0, 0, 0.6))",
              backdropFilter: "blur(4px)",
              padding: isMobile ? "16px 24px" : "24px 48px",
              borderRadius: "12px",
              boxShadow: "var(--coming-soon-shadow, 0 8px 32px rgba(0,0,0,0.3))",
              border: "var(--coming-soon-border, none)",
            }}
          >
            <span
              style={{
                fontSize: isMobile ? "var(--title-font-size-mobile)" : "var(--title-font-size)",
                fontWeight: 700,
                color: "var(--color-text)",
                textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
                fontFamily: "var(--font-display)",
              }}
            >
              {activeTour.name} Coming Soon
            </span>
          </div>
        </div>
      )}
      {/* Mobile full-screen popup */}
      <Drawer
        isOpen={isMobile && !!selectedCity}
        onClose={() => setSelectedCity(null)}
        title={
          selectedCity ? `${selectedCity.city}, ${selectedCity.state}` : ""
        }
        showBackButton
      >
        {isMobile && selectedCity && (
          <CityPopup
            city={selectedCity}
            onClose={() => setSelectedCity(null)}
            showArrow={false}
            inDrawer
          />
        )}
      </Drawer>
    </div>
  );
}

export const FlatMap = React.memo(FlatMapInner);
