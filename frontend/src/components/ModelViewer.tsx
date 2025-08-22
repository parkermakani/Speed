import React, { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OrbitControls,
  useAnimations,
  useGLTF,
  Html,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";

import baseModelUrl from "../assets/3D/SpeedLowPoly_Base.glb";

interface ModelViewerProps {
  /** Height of the viewer (number = px or CSS string). Defaults to 260. */
  height?: number | string;
  /** Disable interactive orbit controls. */
  disableControls?: boolean;
  /** Optional shirt texture URL (relative import or runtime). */
  shirtTexture?: string;
  /** Animation clip name to play (defaults to first) */
  animation?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center style={{ pointerEvents: "none" }}>
      <div
        style={{
          background: "rgba(0,0,0,0.6)",
          color: "white",
          padding: "4px 8px",
          borderRadius: 4,
          fontSize: 12,
        }}
      >
        Loading {progress.toFixed(0)}%
      </div>
    </Html>
  );
}

function SpeedModel({
  shirtTexture,
  animation,
  onAnimationsLoaded,
}: {
  shirtTexture?: string;
  animation?: string;
  onAnimationsLoaded?: (names: string[]) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore – drei loader accepts string
  const gltf = useGLTF(baseModelUrl);
  const texLoader = useMemo(() => {
    const l = new THREE.TextureLoader();
    l.crossOrigin = "anonymous";
    return l;
  }, []);

  const root = useRef<THREE.Group>(null);
  const { actions, names } = useAnimations(gltf.animations, root);

  // Expose available names once
  useEffect(() => {
    if (onAnimationsLoaded) onAnimationsLoaded(names);

    // Development debug: log meshes/materials/textures to find base shirt texture name
    if (process.env.NODE_ENV !== "production" && root.current) {
      console.group("[ModelViewer] Material debug");
      root.current.traverse((o: THREE.Object3D) => {
        if (!(o instanceof THREE.Mesh)) return;
        const mat = o.material as THREE.MeshStandardMaterial;
        console.log(
          `mesh=%s  material=%s  map=%s`,
          o.name,
          mat.name,
          (mat.map as any)?.name ?? "(none)"
        );
      });
      console.groupEnd();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle animation changes
  useEffect(() => {
    if (!names.length) return;
    const toPlay =
      animation && names.includes(animation) ? animation : names[0];
    names.forEach((n) => {
      const action = actions[n];
      if (!action) return;
      if (n === toPlay) {
        action.reset().fadeIn(0.2).play();
      } else {
        action.fadeOut(0.2);
      }
    });
  }, [animation, actions, names]);

  // Shirt material logic
  useEffect(() => {
    if (!root.current) return;
    root.current.traverse((o: THREE.Object3D) => {
      if (!(o instanceof THREE.Mesh)) return;
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      const matName = (mat.name || "").toLowerCase();
      const isShirt =
        matName.includes("shirt") || mesh.name.toLowerCase().includes("shirt");
      if (!isShirt) return;
      if (!shirtTexture) {
        mesh.visible = false;
      } else {
        mesh.visible = true;
        if (mat.map) mat.map.dispose();
        mat.map = null;
        mat.needsUpdate = true;
        texLoader.load(
          shirtTexture,
          (t) => {
            t.flipY = false;
            // for three@0.152+ use colorSpace instead of encoding
            (t as any).colorSpace = THREE.SRGBColorSpace;
            mat.map = t;
            mat.needsUpdate = true;
            console.log("Applied new shirt texture", shirtTexture);
          },
          undefined,
          (err) => console.error("Failed to load shirt texture", err)
        );
      }
    });
  }, [shirtTexture, texLoader]);

  return <primitive ref={root} object={gltf.scene} scale={1.8} />;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  height = "90%",
  disableControls = false,
  shirtTexture,
  animation,
  onAnimationsLoaded,
}) => {
  const prefersReducedMotion = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: "var(--radius-lg, 12px)",
        overflow: "hidden",
        background: "linear-gradient(135deg, #0A3161 0%, #B31942 100%)",
      }}
    >
      <Canvas camera={{ position: [0, 2, 4] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 2, 1]} intensity={0.8} />
        <Suspense fallback={<Loader />}>
          <SpeedModel
            shirtTexture={shirtTexture}
            animation={animation}
            onAnimationsLoaded={onAnimationsLoaded}
          />
        </Suspense>
        {!disableControls && !prefersReducedMotion && (
          <OrbitControls
            enablePan={false}
            autoRotate
            autoRotateSpeed={1}
            target={[0, 2, 0]}
          />
        )}
      </Canvas>
    </div>
  );
};
