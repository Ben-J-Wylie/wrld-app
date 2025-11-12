// src/components/Scene/Lights/PointLight.tsx
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SceneConfig } from "@/components/containers/SceneCore";

export function PointLight() {
  const lightRef = useRef<THREE.PointLight>(null);
  const helperRef = useRef<THREE.PointLightHelper | null>(null);
  const { scene } = useThree();

  // ✅ Pull from lighting.point, not lighting.directional
  const { position, intensity, distance } = SceneConfig.lighting.point;
  const { enabled: debugEnabled } = SceneConfig.debug;

  useEffect(() => {
    if (!lightRef.current) return;

    const light = lightRef.current;
    light.position.set(...position);
    light.intensity = intensity;
    light.distance = distance ?? 50; // default reach if undefined
    light.decay = 0.2; // physically correct falloff
    light.castShadow = true;

    // 🔧 Shadow tuning
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 2;

    // 🧭 Optional: enable helper for debug
    if (debugEnabled) {
      const helper = new THREE.PointLightHelper(light, 0.5, 0x44aaff);
      helperRef.current = helper;
      scene.add(helper);
    }

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [scene, position, intensity, distance, debugEnabled]);

  return (
    <pointLight
      ref={lightRef}
      color="#ff0000"
      intensity={intensity}
      position={position}
      distance={distance}
      decay={0.2}
      castShadow
    />
  );
}
