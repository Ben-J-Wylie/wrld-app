// SceneCore/Layers/ImagePlanePrimitive.ts
import * as THREE from "three";

export interface ImagePlanePrimitiveOptions {
  src?: string;
  color?: string | number;

  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function createImagePlane(options: ImagePlanePrimitiveOptions) {
  const {
    src,
    color,

    castShadow = true,
    receiveShadow = true,
  } = options;

  // ---------- Texture ----------
  const texture = src ? new THREE.TextureLoader().load(src) : null;

  const geo = new THREE.PlaneGeometry(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    map: texture ?? null,
    color: texture ? 0xffffff : color ?? 0x888888,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.FrontSide,
  });

  const mesh = new THREE.Mesh(geo, mat);

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  return mesh;
}
