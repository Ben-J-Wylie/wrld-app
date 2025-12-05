// src/components/containers/SceneCore/Lights/DirectionalLight.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

import { getSceneCamera } from "../Cameras/SceneCameraRegistry";

export interface DirectionalLightProps {
  shadowSize?: number;
  frustumSize?: number;
  intensity?: number;
  position?: [number, number, number];

  shadowRadius?: number;
  shadowBias?: number;
  shadowNormalBias?: number;

  followSceneCamera?: boolean;

  showLightHelper?: boolean;
  showShadowHelper?: boolean;
}

export function DirectionalLight({
  shadowSize = 4096,
  frustumSize = 1000,
  intensity = 2,
  position = [-200, 100, 500],

  shadowRadius = 40.0,
  shadowBias = -0.001,
  shadowNormalBias = 0.02,

  followSceneCamera = true,

  showLightHelper = false,
  showShadowHelper = false,
}: DirectionalLightProps) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  const helperLightRef = useRef<THREE.DirectionalLightHelper | null>(null);
  const helperShadowRef = useRef<THREE.CameraHelper | null>(null);

  const scene = useThree((s) => s.scene);

  // Base positions (do not change)
  const baseLightPos = new THREE.Vector3(...position);
  const baseTargetPos = new THREE.Vector3(0, 0, 0);

  // ---------------------------------------------------------------------------
  // INIT — set up target, shadows, helpers
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;

    // Ensure target is in the scene graph
    scene.add(target);

    // IMPORTANT: ensure the light uses our custom target
    light.target = target;
    light.target.updateMatrixWorld(true);

    // Shadow camera setup
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -frustumSize;
    cam.right = frustumSize;
    cam.top = frustumSize;
    cam.bottom = -frustumSize;
    cam.near = 0.5;
    cam.far = 2000;
    cam.updateProjectionMatrix();

    // Light helper
    if (showLightHelper) {
      const dl = new THREE.DirectionalLightHelper(light, 50);
      helperLightRef.current = dl;
      scene.add(dl);
    }

    // Shadow camera helper
    if (showShadowHelper) {
      const sh = new THREE.CameraHelper(cam);
      helperShadowRef.current = sh;
      scene.add(sh);
    }

    return () => {
      // Cleanup helpers
      helperLightRef.current?.removeFromParent();
      helperLightRef.current?.dispose();

      if (helperShadowRef.current) {
        helperShadowRef.current.removeFromParent();
        helperShadowRef.current.geometry.dispose();
        (helperShadowRef.current.material as THREE.Material).dispose();
      }
    };
  }, [scene, frustumSize, showLightHelper, showShadowHelper]);

  // ---------------------------------------------------------------------------
  // FOLLOW CAMERA — XY only (ignore Z entirely)
  // ---------------------------------------------------------------------------
  useFrame(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    const cam = getSceneCamera();

    if (!cam) return;

    if (!followSceneCamera) {
      // Static mode
      light.position.copy(baseLightPos);
      target.position.copy(baseTargetPos);
    } else {
      // Camera follow mode: only X and Y
      const camPos = cam.getWorldPosition(new THREE.Vector3());

      light.position.set(
        baseLightPos.x + camPos.x,
        baseLightPos.y + camPos.y,
        baseLightPos.z // keep Z unchanged
      );

      target.position.set(
        baseTargetPos.x + camPos.x,
        baseTargetPos.y + camPos.y,
        baseTargetPos.z // keep Z unchanged
      );
    }

    // IMPORTANT: rebind target every frame so R3F doesn't override it
    light.target = target;
    light.target.updateMatrixWorld();

    // Update helpers
    helperLightRef.current?.update();
    helperShadowRef.current?.update();
  });

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <>
      <object3D ref={targetRef} />

      <directionalLight
        ref={lightRef}
        castShadow
        intensity={intensity}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-radius={shadowRadius}
        shadow-bias={shadowBias}
        shadow-normalBias={shadowNormalBias}
      />
    </>
  );
}
