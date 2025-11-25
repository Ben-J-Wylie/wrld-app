// Layers/Backdrop.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";
import { useSceneStore } from "../Store/SceneStore";

// ----------------------------------
// Exported dimensions type
// ----------------------------------
export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

// ----------------------------------
// Backdrop component (reads store)
// ----------------------------------
export const Backdrop = forwardRef<
  THREE.Mesh,
  { color?: THREE.ColorRepresentation }
>(({ color = "#dc4c4c" }, ref) => {
  const width = useSceneStore((s) => s.sceneWidth);
  const height = useSceneStore((s) => s.sceneHeight);

  return (
    <mesh ref={ref}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
});

Backdrop.displayName = "Backdrop";
