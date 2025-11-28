// CameraSwitcher.tsx
import * as THREE from "three";
import React, { useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { SceneCamera } from "./SceneCamera";
import { OrbitCamera } from "./OrbitCamera";

interface CameraSwitcherProps {
  sceneCamRef: React.RefObject<THREE.PerspectiveCamera>;
  orbitCamRef: React.RefObject<THREE.PerspectiveCamera>;
}

export function CameraSwitcher({
  sceneCamRef,
  orbitCamRef,
}: CameraSwitcherProps) {
  const { gl, set } = useThree();
  const [active, setActive] = useState<"scene" | "orbit">("scene");

  // ---------------------------------------------------------------------------
  // Toggle with "c"
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "c") {
        setActive((prev) => (prev === "scene" ? "orbit" : "scene"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Every frame:
  // 1. Update both cameras' aspect ratios to match viewport
  // 2. Activate whichever camera is selected
  // ---------------------------------------------------------------------------
  useFrame(() => {
    const { clientWidth, clientHeight } = gl.domElement;
    const aspect = clientWidth / clientHeight;

    // Update both cameras, even when inactive
    const allCams = [sceneCamRef.current, orbitCamRef.current];
    allCams.forEach((cam) => {
      if (!cam) return;
      cam.aspect = aspect;
      cam.updateProjectionMatrix();
    });

    // Activate active cam
    const cam = active === "scene" ? sceneCamRef.current : orbitCamRef.current;

    if (cam) {
      set({ camera: cam });
    }
  });

  return (
    <>
      {/* Camera Instances */}
      <SceneCamera ref={sceneCamRef} />
      <OrbitCamera ref={orbitCamRef} />

      {/* Orbit controls activate only for orbitCam */}
      <OrbitControls
        enabled={active === "orbit"}
        camera={orbitCamRef.current ?? undefined}
      />
    </>
  );
}
