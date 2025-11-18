import * as THREE from "three";

export interface CubePrimitiveOptions {
  size?: [number, number, number];
  color?: string | number;
  position?: [number, number, number];
}

export function createBox({
  size = [1, 1, 1],
  color = "white",
  position = [0, 0, 0],
}: CubePrimitiveOptions) {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2]);

  const material = new THREE.MeshStandardMaterial({
    color,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(position[0], position[1], position[2]);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  return mesh;
}
