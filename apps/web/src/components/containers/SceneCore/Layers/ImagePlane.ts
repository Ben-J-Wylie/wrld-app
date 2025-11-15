// src/ImagePlane.ts
import * as THREE from "three";

export interface ImagePlaneOptions {
  src: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
}

export function createImagePlane(options: ImagePlaneOptions) {
  const { src, width, height, position = [0, 0, 0] } = options;

  // Internal fallback color
  const fallbackColor = 0x444444;

  // Placeholder geometry initially (1x1)
  const geo = new THREE.PlaneGeometry(1, 1);

  // Material with alpha support
  const mat = new THREE.MeshStandardMaterial({
    color: fallbackColor,
    transparent: true,
    alphaTest: 0.01,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Vertical plane (PlaneGeometry already faces +Z)
  mesh.rotation.set(0, 0, 0);
  mesh.position.set(position[1], position[1], position[2]);

  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Load texture
  const loader = new THREE.TextureLoader();

  loader.load(
    src,

    // ---------------------------
    // onLoad
    // ---------------------------
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace; // modern API

      mat.map = texture;
      mat.color = new THREE.Color(0xffffff);

      const aspect = texture.image.width / texture.image.height;

      let finalWidth = width;
      let finalHeight = height;

      if (width && !height) finalHeight = width / aspect;
      else if (height && !width) finalWidth = height * aspect;
      else if (!width && !height) {
        finalWidth = 1;
        finalHeight = 1 / aspect;
      }

      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(finalWidth!, finalHeight!);

      mat.needsUpdate = true;
    },

    // ---------------------------
    // onProgress (unused)
    // ---------------------------
    undefined,

    // ---------------------------
    // onError
    // ---------------------------
    () => {
      console.warn(
        `ImagePlane: failed to load "${src}". Using fallback color.`
      );

      const finalWidth = width ?? 1;
      const finalHeight = height ?? 1;

      mesh.geometry.dispose();
      mesh.geometry = new THREE.PlaneGeometry(finalWidth, finalHeight);

      mat.map = null;
      mat.color = new THREE.Color(fallbackColor);
      mat.needsUpdate = true;
    }
  );

  return mesh;
}
