// src/Backdrop.ts
import * as THREE from "three";

export interface BackdropOptions {
  width: number;
  height: number;
}

export function createBackdrop(options: BackdropOptions) {
  const { width, height } = options;

  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x333333,
  });

  const backdrop = new THREE.Mesh(geo, mat);

  backdrop.rotation.set(0, 0, 0);
  backdrop.position.z = 0;
  backdrop.receiveShadow = true;

  return backdrop;
}

// Helper to resize an existing backdrop when sceneWidth/sceneHeight change
export function resizeBackdrop(
  backdrop: THREE.Mesh,
  width: number,
  height: number
) {
  // Dispose the old geometry to avoid leaks
  backdrop.geometry.dispose();
  backdrop.geometry = new THREE.PlaneGeometry(width, height);
}
