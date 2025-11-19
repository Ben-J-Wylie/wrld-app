// SceneCore/Layers/ImagePlanePrimitive.ts
import * as THREE from "three";
import { ShadowProps } from "@/components/containers/SceneCore/Shadows/ShadowTypes";

export interface ImagePlanePrimitiveOptions extends ShadowProps {
  src?: string;
  color?: string | number;
}

export function createImagePlane(options: ImagePlanePrimitiveOptions) {
  const {
    src,
    color,

    castShadow = false,
    receiveShadow = false,
  } = options;

  // ---------- Texture ----------
  const textureLoader = new THREE.TextureLoader();
  const texture = src ? textureLoader.load(src) : null;

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
