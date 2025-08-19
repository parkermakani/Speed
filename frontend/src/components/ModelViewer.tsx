import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

import speedPinUrl from "../assets/3D/SpeedPin.glb";

interface ModelViewerProps {
  /** Height of the viewer (number = px or CSS string). Defaults to 260. */
  height?: number | string;
  /** Disable interactive orbit controls. */
  disableControls?: boolean;
}

function SpeedPinModel() {
  // useGLTF caches by URL under the hood.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore – drei types expect fixed string literal but runtime allows string
  const { scene } = useGLTF(speedPinUrl);
  return <primitive object={scene} scale={2.0} />;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  height = 260,
  disableControls = false,
}) => {
  // Determine whether user prefers reduced motion (memoized).
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
        background: "linear-gradient(135deg, #0A3161 0%, #B31942 100%)", // Liberty blue → Freedom red
      }}
    >
      <Canvas camera={{ position: [0, 1, 2] }}>
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 2, 1]} intensity={0.8} />

        <Suspense fallback={null}>
          <SpeedPinModel />
        </Suspense>

        {/* Interactive controls unless reduced motion preferred or explicitly disabled */}
        {!disableControls && !prefersReducedMotion && (
          <OrbitControls
            enablePan={false}
            autoRotate
            autoRotateSpeed={1}
            target={[0, 1, 0]}
          />
        )}
      </Canvas>
    </div>
  );
};

// Drei GLTF loader needs this to dispose on unmount.
// Prevents memory leak warnings during HMR.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – `dispose` is available at runtime
useGLTF.preload(speedPinUrl);
