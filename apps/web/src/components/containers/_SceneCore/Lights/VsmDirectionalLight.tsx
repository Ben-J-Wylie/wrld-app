// @ts-nocheck

// src/components/containers/SceneCore/Lights/VsmDirectionalLight.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export function VsmDirectionalLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const targetRef = useRef(new THREE.Object3D());
  const { scene } = useThree();

  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;

    // Make sure target is in the scene graph
    if (!scene.children.includes(target)) {
      scene.add(target);
    }

    // --- POSITION / TARGET (similar to example) ---
    light.position.set(3, 12, 17);
    target.position.set(0, 0, 0);
    light.target = target;

    // --- COLOR & INTENSITY ---
    light.color.set(0x8888ff);
    light.intensity = 3;

    // --- SHADOW CORE SETTINGS (VSM) ---
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512); // like example
    light.shadow.bias = -0.0005;

    // These two are what you care about 👇
    light.shadow.radius = 4; // penumbra softness
    (light.shadow as any).blurSamples = 8; // VSM filter quality

    // --- ORTHO SHADOW CAMERA (tuned to your world size) ---
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.near = 0.1;
    cam.far = 50;
    cam.left = -5;
    cam.right = 5;
    cam.top = 5;
    cam.bottom = -5;
    cam.updateProjectionMatrix();
  }, [scene]);

  return (
    <>
      <directionalLight ref={lightRef} castShadow />
      <primitive object={targetRef.current} />
    </>
  );
}
