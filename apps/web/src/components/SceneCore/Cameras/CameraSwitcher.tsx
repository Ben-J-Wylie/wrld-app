// CameraSwitcher.tsx
import * as THREE from "three";
import React, { useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { SceneCamera } from "./SceneCamera";
import { OrbitCamera } from "./OrbitCamera";

export function CameraSwitcher() {
  const { set } = useThree();

  const sceneCam = useRef<THREE.PerspectiveCamera>(null!);
  const orbitCam = useRef<THREE.PerspectiveCamera>(null!);

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

  // Update renderer camera each frame
  useFrame(() => {
    if (active === "scene" && sceneCam.current) {
      set({ camera: sceneCam.current });
    } else if (active === "orbit" && orbitCam.current) {
      set({ camera: orbitCam.current });
    }
  });

  return (
    <>
      <SceneCamera ref={sceneCam} />
      <OrbitCamera ref={orbitCam} />

      {/* OrbitControls only active when orbit camera is selected */}
      <OrbitControls
        enabled={active === "orbit"}
        camera={orbitCam.current ?? undefined}
      />
    </>
  );
}
