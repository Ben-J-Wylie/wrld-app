// Backdrop.tsx
import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";

export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

export interface BackdropProps {
  presetSizes: BackdropDimensions; // required
  breakpoint?: "mobile" | "tablet" | "desktop"; // optional override
  color?: THREE.ColorRepresentation;
}

export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  (
    {
      presetSizes,
      breakpoint = "desktop", // default for now
      color = "#dc4c4c",
    },
    ref
  ) => {
    // Pick width/height based on breakpoint
    const { width, height } = useMemo(() => {
      return presetSizes[breakpoint] ?? presetSizes.desktop;
    }, [presetSizes, breakpoint]);

    return (
      <mesh ref={ref}>
        {/* Plane faces +Z by default */}
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} />
      </mesh>
    );
  }
);

Backdrop.displayName = "Backdrop";
