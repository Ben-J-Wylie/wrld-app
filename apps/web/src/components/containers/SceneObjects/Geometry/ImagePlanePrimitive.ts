// SceneCore/Layers/ImagePlanePrimitive.ts
import * as THREE from "three";

export interface ImagePlanePrimitiveOptions {
  /** File texture */
  src?: string;
  color?: string | number;

  /** DOM texture (from DomSurface) */
  domSurface?: {
    texture: THREE.Texture | null;
    width: number;
    height: number;
  } | null;

  /** Convenience toggle */
  useDomSurface?: boolean;

  /** Pixel → world unit scale for DOM textures */
  domPixelScale?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;
}

export function createImagePlane(options: ImagePlanePrimitiveOptions) {
  const {
    src,
    color,

    domSurface = null,
    useDomSurface = false,
    domPixelScale = 0.01,

    castShadow = true,
    receiveShadow = true,
  } = options;

  let width = 1;
  let height = 1;

  let texture: THREE.Texture | null = null;
  let material: THREE.Material;

  // ------------------------------------------------------------
  // CASE 1 — DOM TEXTURE MODE
  // ------------------------------------------------------------
  if (useDomSurface && domSurface && domSurface.texture) {
    texture = domSurface.texture;

    // Convert DOM px → world units
    width = domSurface.width * domPixelScale;
    height = domSurface.height * domPixelScale;

    // DOM textures should not be lit → BasicMaterial
    material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    });
  }

  // ------------------------------------------------------------
  // CASE 2 — NORMAL IMAGE FILE
  // ------------------------------------------------------------
  else if (src) {
    texture = new THREE.TextureLoader().load(src);

    material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.FrontSide,
    });
  }

  // ------------------------------------------------------------
  // CASE 3 — COLOR ONLY (fallback)
  // ------------------------------------------------------------
  else {
    material = new THREE.MeshStandardMaterial({
      color: color ?? 0xffffff,
      transparent: true,
      alphaTest: 0.01,
      side: THREE.FrontSide,
    });
  }

  // ------------------------------------------------------------
  // GEOMETRY
  // ------------------------------------------------------------
  //
  // For DOM textures, width/height are derived from pixel size.
  // For file textures, ImagePlane.tsx will scale the plane later.
  //
  const geo = new THREE.PlaneGeometry(width, height);

  // ------------------------------------------------------------
  // Mesh
  // ------------------------------------------------------------
  const mesh = new THREE.Mesh(geo, material);

  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  // Expose texture reference (useful for debugging)
  // @ts-ignore
  mesh.userData.domSurface = domSurface || null;

  return mesh;
}
