import * as THREE from "three";
import React, { forwardRef, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

export const OrbitCamera = forwardRef<THREE.PerspectiveCamera>((props, ref) => {
  const camRef = useRef<THREE.PerspectiveCamera>(null!);
  // We no longer call `set({ camera: cam })` here
  useThree(); // still okay if you want access later; otherwise can remove

  useEffect(() => {
    const cam = camRef.current;

    cam.near = 1;
    cam.far = 12000;
    cam.fov = 45;
    cam.position.set(0, 400, 1200);
    cam.updateProjectionMatrix();
  }, []);

  return (
    <perspectiveCamera
      ref={(node) => {
        camRef.current = node!;
        if (typeof ref === "function") ref(node!);
        else if (ref) (ref as any).current = node!;
      }}
      {...props}
    />
  );
});

OrbitCamera.displayName = "OrbitCamera";
