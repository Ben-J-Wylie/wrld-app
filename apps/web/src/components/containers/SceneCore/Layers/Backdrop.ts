// src/Backdrop.ts
import * as THREE from "three";

export interface BackdropOptions {
  width?: number;
  height?: number;
}

export function createBackdrop(options: BackdropOptions = {}) {
  const { width = 20, height = 20 } = options;

  // Geometry & Material (color stays internal)
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x333333, // internal default
  });

  const backdrop = new THREE.Mesh(geo, mat);

  // Vertical orientation (normal +Z)
  backdrop.rotation.set(0, 0, 0);

  // Internal default depth
  backdrop.position.z = 0;

  // Must receive shadows
  backdrop.receiveShadow = true;

  return backdrop;
}