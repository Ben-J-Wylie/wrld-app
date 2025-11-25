// OrbitCamera.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";

export const OrbitCamera = forwardRef<THREE.PerspectiveCamera>((props, ref) => {
  return (
    <perspectiveCamera
      ref={ref}
      position={[0, 400, 1200]}
      fov={45}
      near={1}
      far={5000}
      {...props}
    />
  );
});

OrbitCamera.displayName = "OrbitCamera";
