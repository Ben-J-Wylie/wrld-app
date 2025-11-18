import * as THREE from "three";

export interface ImagePlanePrimitiveOptions {
  src: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
}

export function createImagePlane({
  src,
  width,
  height,
  position = [0, 0, 0],
}: ImagePlanePrimitiveOptions) {
  const textureLoader = new THREE.TextureLoader();
  const texture = textureLoader.load(src);

  // Temporarily use 1×1 until texture loads if no explicit size is provided
  const geo = new THREE.PlaneGeometry(width ?? 1, height ?? 1);

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.01, // stable PNG transparency
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(position[0], position[1], position[2]);

  mesh.receiveShadow = true;

  return mesh;
}
