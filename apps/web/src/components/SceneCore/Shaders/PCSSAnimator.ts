// src/components/containers/SceneCore/Shaders/PCSSAnimator.tsx
import React, { useEffect } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { patchMaterialForPCSS, PCSSUniformHandles, enablePCSS } from "./PCSS";

// -----------------------------------------------------------------------------
// Tunable PCSS defaults (edit here instead of DemoScene)
// -----------------------------------------------------------------------------
const PCSS_ROTATION_SPEED = 0.5; // radians/sec; 0.3–0.8 is nice
const PCSS_NOISE_INTENSITY = 0.8; // 0.5–1.0; higher = more jitter
const PCSS_BLUR_STRENGTH = 0.7; // 0..1; 0 = base PCF, 1 = extra blur
const PCSS_PENUMBRA_SCALE = 1.5; // 0.5..3; higher = larger penumbra

export interface PCSSAnimatorProps {
  // You can leave this empty for now; props kept for future if needed.
  rotationSpeed?: number;
  noiseIntensity?: number;
  blurStrength?: number;
  penumbraScale?: number;
}

/**
 * PCSSAnimator:
 * - Ensures PCSS is enabled on the renderer & ShaderChunk
 * - Patches shadow-receiving lit materials with PCSS uniforms
 * - Updates those uniforms every frame
 */
export function PCSSAnimator({
  rotationSpeed = PCSS_ROTATION_SPEED,
  noiseIntensity = PCSS_NOISE_INTENSITY,
  blurStrength = PCSS_BLUR_STRENGTH,
  penumbraScale = PCSS_PENUMBRA_SCALE,
}: PCSSAnimatorProps) {
  const { gl, scene } = useThree();

  // Ensure PCSS is globally enabled on this renderer
  // (safe to call many times; internal guard prevents re-patch)
  enablePCSS(gl);

  // Patch all relevant materials once on mount
  useEffect(() => {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.receiveShadow) return;

      const materials: THREE.Material[] = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((mat) => {
        if (!mat) return;
        // Only lit materials have "lights" support
        if (!("lights" in mat)) return;
        patchMaterialForPCSS(mat);
      });
    });
  }, [scene]);

  // Animate uniforms every frame
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const rotation = t * rotationSpeed;

    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.receiveShadow) return;

      const materials: THREE.Material[] = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];

      materials.forEach((mat) => {
        if (!mat) return;
        const anyMat = mat as any;
        const u = anyMat.userData?.pcssUniforms as
          | PCSSUniformHandles
          | undefined;
        if (!u) return;

        if (u.rotation) u.rotation.value = rotation;
        if (u.noiseIntensity) u.noiseIntensity.value = noiseIntensity;
        if (u.blurStrength) u.blurStrength.value = blurStrength;
        if (u.penumbraScale) u.penumbraScale.value = penumbraScale;
      });
    });
  });

  return null;
}
