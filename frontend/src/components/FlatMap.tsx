import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import AnimatedMotorcycle from "./AnimatedMotorcycle";
import ReactDOM from "react-dom/client";
// Quote overlay removed; quote will be rendered at page level

interface FlatMapProps {
  lat: number;
  lng: number;
  state?: string | null;
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

export function FlatMap({ lat, lng, state }: FlatMapProps) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [loading, setLoading] = useState(true);

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
      setInterval(() => {
        mapRef.current?.setPaintProperty(
          highlightId,
          "fill-opacity",
          up ? 0.35 : 0.15
        );
        up = !up;
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

    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      return;
    }

    const create = () => {
      const container = document.createElement("div");
      // size controlled by component; just ensure pointer events none so doesn't block map interactions
      container.style.pointerEvents = "none";

      // Mount React component inside container
      ReactDOM.createRoot(container).render(<AnimatedMotorcycle size={300} />);

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

  useEffect(() => {
    if (!containerRef.current) return;

    // Expanded bounds give users room to pan/zoom slightly beyond mainland USA
    const usaBounds: [number, number][] = [
      [-135, 15], // west / south margins extended ~10°
      [-55, 55], // east / north margins extended ~5–6°
    ];

    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: import.meta.env.VITE_MAPBOX_STYLE,
      center: [-95, 40], // rough USA centre
      zoom: 2.2, // fits USA slightly farther out
      pitch: 0,
      bearing: 0,
      dragRotate: false,
      pitchWithRotate: false,
    });

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
      mapRef.current?.remove();
    };
  }, []);

  // Update on prop changes
  useEffect(() => {
    if (!mapRef.current) return;
    addMarker();
    addStateLayers(state || "");
  }, [lat, lng, state]);

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
    return (
      <div style={{ padding: "1rem", textAlign: "center" }}>
        Mapbox token missing
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
    </div>
  );
}
