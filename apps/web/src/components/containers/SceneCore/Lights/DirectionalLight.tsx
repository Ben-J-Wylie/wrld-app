// src/components/Scene/Lights/DirectionalLight.tsx
import { useRef, useEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SceneConfig } from "@/components/containers/SceneCore";
import { CameraHelper } from "three";

export function DirectionalLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const helperRef = useRef<THREE.DirectionalLightHelper | null>(null);
  const { scene } = useThree();

  const { color, position, intensity, target, castShadow, shadow } =
    SceneConfig.lighting.directional;
  const { enabled: debugEnabled } = SceneConfig.debug;

  useEffect(() => {
    if (!lightRef.current) return;
    const camHelper = new CameraHelper(lightRef.current.shadow.camera);
    scene.add(camHelper);
  }, []);

  useEffect(() => {
    if (!lightRef.current) return;
    const light = lightRef.current;

    // 🔹 Core light properties

    light.position.set(...position);
    light.target.position.set(...target);
    scene.add(light.target);

    light.color = new THREE.Color(color);
    light.intensity = intensity;

    light.castShadow = castShadow;

    // 🔹 Shadow setup
    const s = shadow;
    light.shadow.bias = s.bias;
    light.shadow.normalBias = s.normalBias;
    light.shadow.radius = s.radius;
    light.shadow.mapSize.set(...s.mapSize);
    light.shadow.camera.near = s.camera.near;
    light.shadow.camera.far = s.camera.far;
    light.shadow.camera.left = s.camera.left;
    light.shadow.camera.right = s.camera.right;
    light.shadow.camera.top = s.camera.top;
    light.shadow.camera.bottom = s.camera.bottom;

    light.shadow.camera.updateProjectionMatrix();

    // 🔹 Debug helper (if enabled)
    if (debugEnabled) {
      const helper = new THREE.DirectionalLightHelper(light, 1, 0xffaa00);
      helperRef.current = helper;
      scene.add(helper);
    }

    // 🧹 Cleanup on unmount
    return () => {
      scene.remove(light.target);
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [
    scene,
    color,
    position,
    intensity,
    target,
    castShadow,
    shadow,
    debugEnabled,
  ]);

  return (
    <directionalLight
      ref={lightRef}
      color={color}
      intensity={intensity}
      position={position}
      castShadow={castShadow}
    />
  );
}
