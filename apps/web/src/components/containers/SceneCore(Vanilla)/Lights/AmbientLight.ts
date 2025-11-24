// src/AmbientLight.ts
import * as THREE from "three";

export function createAmbientLight() {
  const ambient = new THREE.AmbientLight(0xffffff, 1);

  return ambient;
}
