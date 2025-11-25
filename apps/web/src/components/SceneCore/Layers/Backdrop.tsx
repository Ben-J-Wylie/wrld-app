import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";
import { useSceneStore } from "../Store/SceneStore";

// ----------------------------------
// EXPORT ONLY the dimensions type
// ----------------------------------
export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

// ----------------------------------
// INTERNAL ONLY props (not exported)
// ----------------------------------
interface BackdropProps {
  color?: THREE.ColorRepresentation;
  padding?: number; // uniform padding
}

// ----------------------------------
// Backdrop component (reads store)
// ----------------------------------
export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  ({ color = "#dc4c4c", padding = 50 }, ref) => {
    const width = useSceneStore((s) => s.sceneWidth);
    const height = useSceneStore((s) => s.sceneHeight);

    // uniform padding on all sides
    const { drawWidth, drawHeight } = useMemo(() => {
      const grow = padding * 2;
      return {
        drawWidth: width + grow,
        drawHeight: height + grow,
      };
    }, [width, height, padding]);

    return (
      <mesh ref={ref} receiveShadow>
        <planeGeometry args={[drawWidth, drawHeight]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }
);

Backdrop.displayName = "Backdrop";
