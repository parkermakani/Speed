import { useEffect, useRef, useState } from "react";
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

interface FlatMapProps {
  lat: number;
  lng: number;
  state?: string | null;
  path?: { lat: number; lng: number }[];
  pastCities?: { city?: string; state?: string; lat: number; lng: number }[];
  /** Whether the map is in sleep mode; changes marker to sleeping animation */
  isSleep?: boolean;
}

// Mapbox token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
  console.warn("Please set a valid VITE_MAPBOX_TOKEN in your .env file");
}
mapboxgl.accessToken = MAPBOX_TOKEN || "";

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

export function FlatMap({
  lat,
  lng,
  state,
  path = [],
  pastCities = [],
  isSleep = false,
}: FlatMapProps) {
  const [selectedCity, setSelectedCity] = useState<JourneyCity | null>(null);
  const isMobile = useMediaQuery("(max-width: 1100px)");
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const pastMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const [loading, setLoading] = useState(true);
  const [unsupported, setUnsupported] = useState(false);

  const addStateLayers = async (stateName: string) => {
    if (!mapRef.current) return;
    if (!mapRef.current.isStyleLoaded()) {
      mapRef.current.once("styledata", () => addStateLayers(stateName));
      return;
    }
    const sourceId = "states-geo-src";
    const borderId = "state-border";
    const highlightId = "state-highlight";

    const geojson = await ensureStates();
    // add all states source once
    if (!mapRef.current.getSource(sourceId)) {
      mapRef.current.addSource(sourceId, {
        type: "geojson",
        data: geojson as any,
      });
    }

    // highlight selected state
    const stateFilter = ["==", ["get", "name"], stateName];

    if (!mapRef.current.getLayer(highlightId)) {
      mapRef.current.addLayer({
        id: highlightId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": getCSSVariable("--color-primary") || "#B31942",
          "fill-opacity": 0.2,
        },
        filter: stateFilter,
      });

      // pulse
      let up = true;
      // clear any previous pulse interval stored on map object
      // @ts-ignore
      if (mapRef.current._pulseId) clearInterval(mapRef.current._pulseId);

      // store new interval id on map instance so we can clear later
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
    } else {
      mapRef.current.setFilter(highlightId, stateFilter as any);
    }

    if (!mapRef.current.getLayer(borderId)) {
      mapRef.current.addLayer({
        id: borderId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": getCSSVariable("--color-primary") || "#B31942",
          "line-width": 3,
        },
        filter: stateFilter,
      });
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

    const create = () => {
      const container = document.createElement("div");
      // Allow clicks on marker
      container.style.pointerEvents = "auto";

      // Mount React component inside container
      const MarkerComponent = isSleep ? AnimatedSleeping : AnimatedMotorcycle;
      ReactDOM.createRoot(container).render(
        <MarkerComponent
          size={isSleep ? 220 : 300}
          showBorder={false}
          clickWidth={isSleep ? 200 : 120}
          clickHeight={isSleep ? 140 : 140}
          clickOffsetX={isSleep ? 0 : 150}
          clickOffsetY={isSleep ? 60 : 80}
          showClickBorder={false}
          onClick={() => console.log("Marker clicked")}
        />
      );

      markerRef.current = new mapboxgl.Marker({
        element: container,
        anchor: "center",
        offset: [-50, -45], // half of 300px to align bottom of image with coordinate
      })
        .setLngLat([lng, lat])
        .addTo(map);
    };

    if (map.isStyleLoaded()) {
      map.once("idle", create);
    } else {
      map.once("styledata", () => map.once("idle", create));
    }
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

    if (path.length > 0 && !map.getLayer("journey-path")) {
      map.addLayer({
        id: "journey-path",
        type: "line",
        source: sourceId,
        paint: {
          "line-color": getCSSVariable("--color-primary") || "#B31942",
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

  const renderPastMarkers = () => {
    const map = mapRef.current;
    if (!map || pastCities.length === 0) return;

    // Clear existing markers
    pastMarkersRef.current.forEach((m) => m.remove());
    pastMarkersRef.current = [];

    pastCities.forEach((pt) => {
      const img = document.createElement("img");
      img.src = allIcons[Math.floor(Math.random() * allIcons.length)];
      img.style.width = "60px";
      img.style.height = "60px";
      img.style.cursor = "pointer";
      img.style.pointerEvents = "auto";
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedCity({
          city: (pt as any).city ?? "Unknown",
          state: (pt as any).state ?? "",
          lat: pt.lat,
          lng: pt.lng,
        });
      });
      const mk = new mapboxgl.Marker({ element: img, anchor: "center" })
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

    // Expanded bounds give users room to pan/zoom slightly beyond mainland USA
    const usaBounds: [number, number][] = [
      [-135, 15], // west / south margins extended ~10°
      [-55, 55], // east / north margins extended ~5–6°
    ];

    try {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style:
          import.meta.env.VITE_MAPBOX_STYLE ||
          "mapbox://styles/mapbox/light-v11", // sensible fallback
        center: [-95, 40], // rough USA centre
        zoom: 2.2, // fits USA slightly farther out
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
    // Allow a bit more zoom-out and keep loose bounds
    mapRef.current.setMinZoom(2.0);
    mapRef.current.setMaxBounds(usaBounds as any);

    mapRef.current.on("load", () => {
      // refine bounds & minzoom now that style is ready
      mapRef.current!.fitBounds(usaBounds as any, { padding: 60, duration: 0 });
      // Keep previous minZoom (2.0) so user can zoom out a bit

      // draw USA polygons and highlight state
      addStateLayers(state || "");
      addMarker();
      drawPath();
      renderPastMarkers();
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
      mapRef.current?.remove();
    };
  }, []);

  // Update on prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    addMarker();
    addStateLayers(state || "");
    drawPath();
    renderPastMarkers();
  }, [lat, lng, state, path, pastCities, isSleep]);

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
      ReactDOM.createRoot(container).render(
        <CityPopup
          city={selectedCity}
          onClose={() => setSelectedCity(null)}
          showArrow
        />
      );

      // Close when clicking elsewhere on the map
      const handleMapClick = () => setSelectedCity(null);
      map.on("click", handleMapClick);

      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        offset: 15,
        className: "city-popup",
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
      {/* Mobile full-screen popup */}
      <Drawer
        isOpen={isMobile && !!selectedCity}
        onClose={() => setSelectedCity(null)}
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
