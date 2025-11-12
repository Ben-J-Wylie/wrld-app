// src/Scene/Lights/AmbientLight.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { SceneConfig } from "@/components/containers/SceneCore";

export function AmbientLight() {
  const lightRef = useRef<THREE.AmbientLight>(null);

  useEffect(() => {
    if (!lightRef.current) return;
    // You could dynamically adjust intensity here if needed.
  }, []);

  const { ambient } = SceneConfig.lighting;

  return <ambientLight ref={lightRef} intensity={ambient} />;
}
