// SceneCore/Theme/materials.ts
import * as THREE from "three";

/**
 * NOTE: these are *factory functions* instead of singletons,
 * so you can create unique material instances per mesh if needed.
 */
export const WrldMaterials = {
  matteWhite: () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.1,
    }),

  mattePanel: () =>
    new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.95,
      metalness: 0.0,
    }),

  softMetal: () =>
    new THREE.MeshStandardMaterial({
      color: 0x999999,
      roughness: 0.3,
      metalness: 0.7,
    }),

  accentEmissive: () =>
    new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: new THREE.Color(0xff3366),
      emissiveIntensity: 0.8,
      roughness: 0.4,
      metalness: 0.3,
    }),
} as const;

export type WrldMaterialKey = keyof typeof WrldMaterials;
