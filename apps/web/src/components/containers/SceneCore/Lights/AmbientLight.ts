// src/AmbientLight.ts
import * as THREE from "three";

export function createAmbientLight() {
  // Simple soft ambient fill light
  const ambient = new THREE.AmbientLight(0xffffff, .6);

  // Return directly (no need for a group)
  return ambient;
}
