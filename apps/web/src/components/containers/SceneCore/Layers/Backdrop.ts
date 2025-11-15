// src/Backdrop.ts
import * as THREE from "three";

export function createBackdrop() {
  // --- Geometry & Material ---
  const geo = new THREE.PlaneGeometry(20, 20);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x333333,
  });

  // --- Mesh ---
  const backdrop = new THREE.Mesh(geo, mat);

  // Vertical orientation (normal facing +Z)
  backdrop.rotation.x = 0;
  backdrop.rotation.y = 0;
  backdrop.position.z = -5;

  // MUST be true to receive shadows
  backdrop.receiveShadow = true;

  return backdrop;
}