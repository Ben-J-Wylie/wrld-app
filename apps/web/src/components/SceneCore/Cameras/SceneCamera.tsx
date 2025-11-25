// SceneCamera.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";

export const SceneCamera = forwardRef<THREE.PerspectiveCamera>((props, ref) => {
  return (
    <perspectiveCamera
      ref={ref}
      position={[0, 0, 1000]}
      fov={45}
      near={1}
      far={5000}
      {...props}
    />
  );
});

SceneCamera.displayName = "SceneCamera";
