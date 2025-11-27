// src/components/containers/SceneCore/Lights/DirectionalLight.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

import { getSceneCamera } from "../Cameras/SceneCameraRegistry";

export interface DirectionalLightProps {
  shadowSize?: number; // Shadow map resolution
  frustumSize?: number; // Ortho shadow camera area
  intensity?: number;
  position?: [number, number, number];

  // Shadow tuning
  shadowRadius?: number;
  shadowBias?: number;
  shadowNormalBias?: number;

  // Camera-following behaviour
  followSceneCamera?: boolean;
  followOffset?: [number, number, number];
  targetOffset?: [number, number, number];

  // Helper toggles
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

  followSceneCamera = false,
  followOffset = [0, 300, 600],
  targetOffset = [0, -200, -600],

  showLightHelper = false,
  showShadowHelper = false,
}: DirectionalLightProps) {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const targetRef = useRef<THREE.Object3D>(null!);

  const helperLightRef = useRef<THREE.DirectionalLightHelper | null>(null);
  const helperShadowRef = useRef<THREE.CameraHelper | null>(null);

  const scene = useThree((s) => s.scene);

  // ---------------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------------
  useEffect(() => {
    const light = lightRef.current;
    const target = targetRef.current;

    // Target must be in world space
    scene.add(target);
    target.position.set(0, 0, 0);

    light.target = target;
    light.updateMatrixWorld(true);

    // ------------------------------------------------------------------
    // SHADOW CAMERA SETUP
    // ------------------------------------------------------------------
    const cam = light.shadow.camera as THREE.OrthographicCamera;

    cam.left = -frustumSize;
    cam.right = frustumSize;
    cam.top = frustumSize;
    cam.bottom = -frustumSize;
    cam.near = 0.5;
    cam.far = 800;
    cam.updateProjectionMatrix();

    // ------------------------------------------------------------------
    // HELPERS
    // ------------------------------------------------------------------

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
      // Light helper cleanup
      if (helperLightRef.current) {
        helperLightRef.current.removeFromParent();
        helperLightRef.current.dispose();
      }

      // Shadow helper cleanup
      if (helperShadowRef.current) {
        helperShadowRef.current.removeFromParent();
        helperShadowRef.current.geometry.dispose();
        (helperShadowRef.current.material as THREE.Material).dispose();
      }
    };
  }, [scene, frustumSize, showLightHelper, showShadowHelper]);

  // ---------------------------------------------------------------------
  // FOLLOW REGISTERED SceneCamera (no smoothing / no lerp)
  // ---------------------------------------------------------------------
  useFrame(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    const sceneCamera = getSceneCamera();

    if (followSceneCamera && sceneCamera) {
      sceneCamera.updateMatrixWorld();

      // Light position
      const off = new THREE.Vector3(...followOffset);
      sceneCamera.localToWorld(off);
      light.position.copy(off);

      // Target position
      const tOff = new THREE.Vector3(...targetOffset);
      sceneCamera.localToWorld(tOff);
      target.position.copy(tOff);

      light.target.updateMatrixWorld();
    }

    // Update helpers (only if created)
    if (showLightHelper) helperLightRef.current?.update();
    if (showShadowHelper) helperShadowRef.current?.update();
  });

  // ---------------------------------------------------------------------
  // RENDER LIGHT
  // ---------------------------------------------------------------------
  return (
    <>
      <object3D ref={targetRef} />

      <directionalLight
        ref={lightRef}
        castShadow
        position={position}
        intensity={intensity}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-radius={shadowRadius}
        shadow-bias={shadowBias}
        shadow-normalBias={shadowNormalBias}
      />
    </>
  );
}
