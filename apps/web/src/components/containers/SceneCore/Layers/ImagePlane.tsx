import * as THREE from "three";
import { createGroup, GroupOptions } from "./Group";

export interface ImagePlaneOptions extends GroupOptions {
  src: string;
  width?: number;
  height?: number;
  opacity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

/**
 * createImagePlane
 * ---------------------------------------------------------------------------
 * Lit image plane that supports shadows and correct aspect ratio.
 * Reconstructs geometry after the texture finishes loading.
 */
export function createImagePlane(options: ImagePlaneOptions) {
  const {
    src,
    width = 1,
    height,
    opacity = 1,
    x = 0,
    y = 0,
    depth = 0,
    castShadow = true,
    receiveShadow = false,
  } = options;

  const group = createGroup({ x, y, depth });

  // Temporary placeholder geometry
  const tempHeight = height ?? width;
  const geometry = new THREE.PlaneGeometry(width, tempHeight);

  const textureLoader = new THREE.TextureLoader();
  const material = new THREE.MeshPhongMaterial({
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    shininess: 80,
    specular: new THREE.Color("#ffffff"),
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;

  group.add(mesh);

  // Load actual texture
  textureLoader.load(
    src,
    (texture) => {
      material.map = texture;
      material.needsUpdate = true;

      // compute aspect ratio
      const aspect = texture.image.width / texture.image.height;
      const finalW = width;
      const finalH = height ?? width / aspect;

      // replace geometry with correct aspect-ratio geometry
      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(finalW, finalH);
    },
    undefined,
    (error) => {
      console.warn("Failed to load image plane:", error);
    }
  );

  return group;
}

// Basic usage example:

// const card = createImagePlane({
//   src: "/assets/card.png",
//   width: 3,
//   depth: 1,
//   opacity: 1,
//   castShadow: true,
// });
// engine.scene.add(card);
