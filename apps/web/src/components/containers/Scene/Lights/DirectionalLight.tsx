// src/components/Scene/Lights/DirectionalLight.tsx
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SceneConfig } from "@/Scene";

export function DirectionalLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const helperRef = useRef<THREE.DirectionalLightHelper | null>(null);
  const { scene } = useThree();

  const { position, intensity } = SceneConfig.lighting.directional;
  const { enabled: debugEnabled } = SceneConfig.debug;

  useEffect(() => {
    if (!lightRef.current) return;
    const light = lightRef.current;

    light.position.set(...position);
    light.intensity = intensity;
    light.castShadow = true;

    light.shadow.bias = -0.0005; // small negative to pull shadow off the caster
    light.shadow.normalBias = 0.02; // helps with grazing angles
    light.shadow.radius = 2; // (WebGL2) softens PCF a touch

    // 🔹 Add a target (so the light has direction)
    light.target.position.set(0, 0, 0);
    scene.add(light.target);

    // Shadow bounds
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 50;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;

    // ✅ Attach helper only if debug mode is on
    if (debugEnabled) {
      const helper = new THREE.DirectionalLightHelper(light, 1, 0xffaa00);
      helperRef.current = helper;
      scene.add(helper);
    }

    // Cleanup on unmount
    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [scene, position, intensity, debugEnabled]);

  return (
    <directionalLight
      ref={lightRef}
      color="#ffffff"
      intensity={intensity}
      position={position}
    />
  );
}
