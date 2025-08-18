import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
// Three-js for 3D model marker
// @ts-ignore – three types optional
import * as THREE from "three";
// @ts-ignore – loader path
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Text } from "./primitives";
// Path to GLB model (copied via Vite asset pipeline)
// @ts-ignore – vite url loader
import pinModelUrl from "../assets/3D/SpeedPin.glb?url";

interface MapProps {
  lat: number;
  lng: number;
  state?: string | null;
}

// Set Mapbox access token
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
  console.warn("Please set a valid VITE_MAPBOX_TOKEN in your .env file");
}

mapboxgl.accessToken = MAPBOX_TOKEN || "";

// Helper function to get CSS variable values
const getCSSVariable = (varName: string): string => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
};

// Marker + icon logic removed – no longer needed

// Radius + random offset removed – we’ll center directly on provided coords

// URL to free US states GeoJSON (public domain)
const STATES_GEOJSON_URL =
  "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json";

let statesGeo: any | null = null; // cached geojson

async function ensureStatesGeo(): Promise<any> {
  if (statesGeo) return statesGeo;
  const res = await fetch(STATES_GEOJSON_URL);
  statesGeo = await res.json();
  return statesGeo;
}

export function Map({ lat, lng, state }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoaded = useRef(false);
  const threeLayerAdded = useRef(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [lng || 0, lat || 0],
      zoom: lat && lng ? 6 : 2,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
      antialias: true,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      mapLoaded.current = true;

      if (state) {
        addStateLayer(state);
      }

      add3DMarker();
    });

    // 🆕 Ensure map resizes once the container has its final size
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && mapContainer.current) {
      resizeObserver = new ResizeObserver(() => {
        // Mapbox will only resize if the container's dimensions changed
        map.current?.resize();
      });
      resizeObserver.observe(mapContainer.current);
    } else {
      // Fallback: trigger a resize after a tick if ResizeObserver is unavailable
      setTimeout(() => map.current?.resize(), 0);
    }

    return () => {
      // Disconnect resize observer first to avoid calling resize on a removed map
      resizeObserver?.disconnect();
      map.current?.remove();
    };
  }, []);
  // Update map when coords/state change
  useEffect(() => {
    if (!mapLoaded.current || !map.current) return;

    if (lat && lng) {
      map.current.setCenter([lng, lat]);
    }

    if (state) {
      addStateLayer(state);
    }
  }, [state, lat, lng]);

  const add3DMarker = () => {
    if (!map.current || threeLayerAdded.current) return;

    const merc = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);

    // transformation object like Mapbox example
    const modelRotate = [Math.PI / 2, 0, 0]; // base rotation (Y-up -> Z-up)
    const miles10 = 160930; // metres

    const modelTransform = {
      translateX: merc.x,
      translateY: merc.y,
      translateZ: merc.z - 25000 * merc.meterInMercatorCoordinateUnits(), // sink 50 m
      rotateX: modelRotate[0],
      rotateY: modelRotate[1],
      rotateZ: modelRotate[2],
      scale: merc.meterInMercatorCoordinateUnits() * miles10,
    };

    let scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer;

    const customLayer: mapboxgl.CustomLayerInterface = {
      id: "city-3d-marker",
      type: "custom",
      renderingMode: "3d",
      onAdd(_map, gl) {
        scene = new THREE.Scene();
        camera = new THREE.Camera();
        scene.add(new THREE.AmbientLight(0xffffff, 0.8));

        new GLTFLoader().load(pinModelUrl, (gltf: any) => {
          const model = gltf.scene;

          // Slight downward offset so pin appears embedded
          const depthOffset = -25000 * merc.meterInMercatorCoordinateUnits(); // ~500 m down

          model.position.set(0, depthOffset, 0);

          // Random orientation
          const randomYaw = Math.random() * Math.PI * 2; // full 360°
          const randomTilt = (Math.random() - 0.5) * 0.2; // ± ~11°

          model.rotation.y += randomYaw; // spin around vertical (after X-rot)
          model.rotation.z += randomTilt; // small tilt

          scene.add(model);
        });

        renderer = new THREE.WebGLRenderer({
          canvas: map!.current!.getCanvas(),
          context: gl,
        });
        renderer.autoClear = false;
      },
      render(gl, matrix) {
        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          modelTransform.rotateX
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 1, 0),
          modelTransform.rotateY
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          modelTransform.rotateZ
        );

        const m = new THREE.Matrix4().fromArray(matrix as any);
        const l = new THREE.Matrix4()
          .makeTranslation(
            modelTransform.translateX,
            modelTransform.translateY,
            modelTransform.translateZ
          )
          .scale(
            new THREE.Vector3(
              modelTransform.scale,
              -modelTransform.scale,
              modelTransform.scale
            )
          )
          .multiply(rotationX)
          .multiply(rotationY)
          .multiply(rotationZ);

        camera.projectionMatrix = m.multiply(l);
        renderer.state.reset();
        renderer.render(scene, camera);
        map!.current!.triggerRepaint();
      },
    };

    map.current.addLayer(customLayer);
    threeLayerAdded.current = true;
  };

  const addStateLayer = (stateName: string) => {
    if (!map.current) return;

    const sourceId = "state-geo-source";
    const layerId = "state-geo-outline";
    const fillId = "state-geo-fill";

    ensureStatesGeo().then((geojson) => {
      // find feature for stateName
      const feature = geojson.features.find(
        (f: any) => f.properties && f.properties.name === stateName
      );
      if (!feature) return;

      const collection = { type: "FeatureCollection", features: [feature] };

      if (!map.current!.getSource(sourceId)) {
        map.current!.addSource(sourceId, {
          type: "geojson",
          data: collection as any,
        });
      } else {
        const src = map.current!.getSource(sourceId) as mapboxgl.GeoJSONSource;
        src.setData(collection as any);
      }

      // Add fill layer for pulsing background
      if (!map.current!.getLayer(fillId)) {
        map.current!.addLayer(
          {
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": getCSSVariable("--color-primary") || "#B31942",
              "fill-opacity": 0.15,
            },
          },
          "city-3d-marker"
        );

        // Pulse animation
        let up = true;
        const animate = () => {
          const opacity = up ? 0.35 : 0.15;
          map.current!.setPaintProperty(fillId, "fill-opacity", opacity);
          up = !up;
        };
        setInterval(animate, 1000);
      }

      if (!map.current!.getLayer(layerId)) {
        map.current!.addLayer(
          {
            id: layerId,
            type: "line",
            source: sourceId,
            paint: {
              "line-color": getCSSVariable("--color-primary") || "#B31942",
              "line-width": 4,
            },
          },
          "city-3d-marker"
        );
      }
    });
  };

  // City rectangle logic removed

  if (!MAPBOX_TOKEN || MAPBOX_TOKEN.includes("your-")) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "var(--color-surface)",
          color: "var(--color-text-secondary)",
          padding: "var(--space-8)",
          textAlign: "center",
        }}
      >
        <Text size="lg" weight="medium" color="warning">
          Mapbox Token Required
        </Text>
        <div style={{ marginTop: "var(--space-2)" }}>
          <Text size="sm" color="muted">
            Please add your Mapbox access token to the .env file as
            VITE_MAPBOX_TOKEN
          </Text>
        </div>
        <div style={{ marginTop: "var(--space-4)" }}>
          <Text size="xs" color="muted">
            Get a free token at{" "}
            <a
              href="https://mapbox.com"
              target="_blank"
              style={{ color: "var(--color-accent)" }}
            >
              mapbox.com
            </a>
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "70vh",
          minWidth: "100%",
        }}
      />

      {/* Quote overlay moved to page-level component */}
    </div>
  );
}
