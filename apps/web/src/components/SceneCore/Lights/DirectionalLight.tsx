// ShadowDirectionalLight.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

export function DirectionalLight() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  const lightHelperRef = useRef<THREE.DirectionalLightHelper | null>(null);
  const shadowHelperRef = useRef<THREE.CameraHelper | null>(null);

  const scene = useThree((s) => s.scene);

  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;

    // Add target object
    scene.add(target);
    target.position.set(0, 0, 0);

    light.target = target;

    // ⚡ Force-update the light before configuring shadow camera
    light.updateMatrixWorld(true);

    // ---------------- SHADOW CAMERA SETUP ----------------
    const cam = light.shadow.camera as THREE.OrthographicCamera;

    const size = 1500;
    cam.left = -size;
    cam.right = size;
    cam.top = size;
    cam.bottom = -size;
    cam.near = 1;
    cam.far = 5000;

    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true); // ⚡ critical

    // ---------------- HELPERS ----------------
    const lh = new THREE.DirectionalLightHelper(light, 50);
    const sh = new THREE.CameraHelper(cam);

    lightHelperRef.current = lh;
    shadowHelperRef.current = sh;

    scene.add(lh);
    scene.add(sh);

    return () => {
      if (lightHelperRef.current) {
        scene.remove(lightHelperRef.current);
        lightHelperRef.current.dispose();
      }
      if (shadowHelperRef.current) {
        scene.remove(shadowHelperRef.current);
        shadowHelperRef.current.geometry.dispose();
        (shadowHelperRef.current.material as THREE.Material).dispose();
      }
    };
  }, [scene]);

  // Update helpers each frame
  useFrame(() => {
    lightHelperRef.current?.update();
    shadowHelperRef.current?.update();
  });

  return (
    <>
      <object3D ref={targetRef} />

      <directionalLight
        ref={lightRef}
        castShadow
        position={[-200, 300, 1000]}
        intensity={2}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.0008}
      />
    </>
  );
}
