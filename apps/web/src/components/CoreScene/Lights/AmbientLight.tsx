// src/components/containers/SceneCore/Lights/AmbientLight.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";

export interface AmbientLightProps {
  intensity?: number;
  color?: THREE.ColorRepresentation;
}

/**
 * AmbientLight — simple global fill light
 */
export const AmbientLight = forwardRef<THREE.AmbientLight, AmbientLightProps>(
  ({ intensity = 1, color = 0xffffff }, ref) => {
    return <ambientLight ref={ref} intensity={intensity} color={color} />;
  }
);

AmbientLight.displayName = "AmbientLight";
