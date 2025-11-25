import * as THREE from "three";
import React, { forwardRef, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

export const OrbitCamera = forwardRef<THREE.PerspectiveCamera>((props, ref) => {
  const camRef = useRef<THREE.PerspectiveCamera>(null!);
  const set = useThree((s) => s.set);

  useEffect(() => {
    const cam = camRef.current;

    // Force-apply properties (JSX does not guarantee this order)
    cam.near = 1;
    cam.far = 12000;
    cam.fov = 45;
    cam.position.set(0, 400, 1200);
    cam.updateProjectionMatrix(); // 💥 REQUIRED or far plane won’t apply

    // If you toggle cameras, ensure R3F knows this is the active one
    set({ camera: cam });
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
