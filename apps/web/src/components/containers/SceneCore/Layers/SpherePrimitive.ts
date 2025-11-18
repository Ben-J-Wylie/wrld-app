import * as THREE from "three";

export interface SpherePrimitiveOptions {
  radius?: number;
  color?: string | number;
  position?: [number, number, number];
}

export function createSphere({
  radius = 1,
  color = "white",
  position = [0, 0, 0],
}: SpherePrimitiveOptions) {
  const geometry = new THREE.SphereGeometry(radius, 32, 32);

  const material = new THREE.MeshStandardMaterial({
    color,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
