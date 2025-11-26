// ShadowDirectionalLight.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";

export interface PCSSLightProps {
  shadowSize?: number; // Shadow map resolution
  frustumSize?: number; // Ortho shadow camera area
  intensity?: number; // Light intensity
  position?: [number, number, number];

  /** PCSS parameters */
  pcssLightSize?: number; // Physical light source size
  pcssSearchStep?: number; // Blocker search radius
  pcssFilterStep?: number; // PCF kernel scale
}

export function DirectionalLight({
  shadowSize = 4096,
  frustumSize = 1000,
  intensity = 2,
  position = [-300, 600, 1200],

  pcssLightSize = 0.005, // world-space size of the area light
  pcssSearchStep = 0.002, // search radius for blockers
  pcssFilterStep = 0.001, // filtering radius for PCF
}: PCSSLightProps) {
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

    // attach target to scene graph
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
    cam.far = 5000;

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

    // ------------------------------------------------------------------
    // Inject PCSS uniforms
    // These are consumed by enablePCSS() shader patch
    // ------------------------------------------------------------------
    light.userData.pcss = {
      lightSize: pcssLightSize,
      searchStep: pcssSearchStep,
      filterStep: pcssFilterStep,
    };

    return () => {
      dl.removeFromParent();
      dl.dispose();

      sh.removeFromParent();
      sh.geometry.dispose();
      (sh.material as THREE.Material).dispose();
    };
  }, [scene, frustumSize, pcssLightSize, pcssSearchStep, pcssFilterStep]);

  // ---------------------------------------------------------------------
  // RUNTIME UPDATES
  // ---------------------------------------------------------------------
  useFrame(() => {
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
        /** PCSS uses hard maps — softness handled in shader */
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.002}
      />
    </>
  );
}
