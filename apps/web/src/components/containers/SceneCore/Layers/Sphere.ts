// src/Sphere.ts
import * as THREE from "three";

export function createSphere() {
  const geo = new THREE.SphereGeometry(1, 32, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff8866,
  });

  const sphere = new THREE.Mesh(geo, mat);

  // positioning (same as before)
  sphere.position.set(0, 0, 3);

  // shadow settings
  sphere.castShadow = true;
  sphere.receiveShadow = false; // optional

  return sphere;
}