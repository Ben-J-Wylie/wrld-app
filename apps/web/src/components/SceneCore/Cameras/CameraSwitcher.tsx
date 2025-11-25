// CameraSwitcher.tsx
import * as THREE from "three";
import React, { useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { SceneCamera } from "./SceneCamera";
import { OrbitCamera } from "./OrbitCamera";

interface CameraSwitcherProps {
  sceneCamRef: React.RefObject<THREE.PerspectiveCamera | null>;
  orbitCamRef: React.RefObject<THREE.PerspectiveCamera | null>;
}

export function CameraSwitcher({
  sceneCamRef,
  orbitCamRef,
}: CameraSwitcherProps) {
  const { set } = useThree();
  const [active, setActive] = useState<"scene" | "orbit">("scene");

  // Press 'c' to toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "c") {
        setActive((prev) => (prev === "scene" ? "orbit" : "scene"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Update renderer camera each frame based on 'active'
  useFrame(() => {
    if (active === "scene" && sceneCamRef.current) {
      set({ camera: sceneCamRef.current });
    } else if (active === "orbit" && orbitCamRef.current) {
      set({ camera: orbitCamRef.current });
    }
  });

  return (
    <>
      <SceneCamera ref={sceneCamRef} />
      <OrbitCamera ref={orbitCamRef} />

      {/* OrbitControls only active when orbit camera is selected */}
      <OrbitControls
        enabled={active === "orbit"}
        // When ref isn't set yet, OrbitControls falls back to default three.camera
        camera={orbitCamRef.current ?? undefined}
      />
    </>
  );
}
