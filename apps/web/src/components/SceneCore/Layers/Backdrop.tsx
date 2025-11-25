// Backdrop.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";

export interface BackdropProps {
  width?: number;
  height?: number;
  color?: THREE.ColorRepresentation;
}

export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  ({ width = 1000, height = 1000, color = "#dc4c4c" }, ref) => {
    return (
      <mesh ref={ref}>
        {/* PlaneGeometry faces +Z by default */}
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial color={color} />
      </mesh>
    );
  }
);

Backdrop.displayName = "Backdrop";
