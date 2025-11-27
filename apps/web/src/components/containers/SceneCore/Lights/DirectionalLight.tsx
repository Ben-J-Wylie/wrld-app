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

    // Target MUST be world-space
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
    const dl = new THREE.DirectionalLightHelper(light, 50);
    const sh = new THREE.CameraHelper(cam);

    helperLightRef.current = dl;
    helperShadowRef.current = sh;

    scene.add(dl);
    scene.add(sh);

    return () => {
      dl.removeFromParent();
      dl.dispose();
      sh.removeFromParent();
      sh.geometry.dispose();
      (sh.material as THREE.Material).dispose();
    };
  }, [scene, frustumSize]);

  // ---------------------------------------------------------------------
  // FOLLOW **ONLY** THE REGISTERED SceneCamera
  // ---------------------------------------------------------------------
  useFrame(() => {
    const light = lightRef.current;
    const target = targetRef.current;
    const sceneCamera = getSceneCamera();

    if (followSceneCamera && sceneCamera) {
      // Make sure camera matrix is current (optional)
      sceneCamera.updateMatrixWorld();

      // Follow position
      const off = new THREE.Vector3(...followOffset);
      sceneCamera.localToWorld(off);
      light.position.copy(off);

      // Follow target
      const tOff = new THREE.Vector3(...targetOffset);
      sceneCamera.localToWorld(tOff);
      target.position.copy(tOff);

      light.target.updateMatrixWorld();
    }

    helperLightRef.current?.update();
    helperShadowRef.current?.update();
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
