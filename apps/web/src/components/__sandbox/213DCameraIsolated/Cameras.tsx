import React, { useEffect, useState } from "react";
import {
  OrthographicCamera,
  PerspectiveCamera,
  OrbitControls,
  Html,
} from "@react-three/drei";

/**
 * Cameras.tsx
 * -------------------------------------------------------------------
 * Provides both Orthographic and Perspective cameras, with keyboard
 * toggling via the "C" key. When Perspective is active, OrbitControls
 * are automatically enabled.
 */

export default function Cameras() {
  const [usePerspective, setUsePerspective] = useState(false);

  // Toggle between cameras with "C" key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "c") setUsePerspective((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {usePerspective ? (
        <>
          {/* === Perspective Camera === */}
          <PerspectiveCamera
            makeDefault
            position={[0, 2, 5]}
            fov={50}
            near={0.1}
            far={100}
          />
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            enableDamping
            dampingFactor={0.1}
            minDistance={2}
            maxDistance={100}
            target={[0, 0, 0]}
          />
        </>
      ) : (
        <>
          {/* === Orthographic Camera === */}
          <OrthographicCamera
            makeDefault
            position={[0, 0, 10]}
            zoom={100}
            near={0.1}
            far={100}
          />
        </>
      )}

      {/* HUD Overlay (uses drei Html, so it renders inside Canvas) */}
      <Html position={[-20, 10, 0]}>
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            color: "#aaa",
            fontFamily: "monospace",
            fontSize: 12,
            userSelect: "none",
            pointerEvents: "none",
          }}
        >
          Camera: {usePerspective ? "Perspective" : "Orthographic"} (press "C"
          to toggle)
        </div>
      </Html>
    </>
  );
}
