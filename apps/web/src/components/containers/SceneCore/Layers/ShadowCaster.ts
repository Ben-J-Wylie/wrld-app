// ShadowCaster.ts
import * as THREE from "three";
import html2canvas from "html2canvas";

/**
 * Creates a silhouette texture based on a DOM node.
 *
 * Opaque DOM pixels become white.
 * Transparent pixels remain transparent.
 */
export async function createSilhouetteTexture(
  el: HTMLElement
): Promise<THREE.Texture | null> {
  if (!el) return null;

  const canvas = await html2canvas(el, {
    backgroundColor: null,
    scale: 1,
    useCORS: true,
  });

  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;

  // convert to silhouette
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];

    if (alpha > 5) {
      // visible → solid white
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    } else {
      // invisible
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;

  return tex;
}

/**
 * Builds the THREE.Mesh that will cast shadows using the silhouette.
 * NOTE: The alphaMap is applied LATER inside Dom3D.tsx
 */
export function createShadowCasterPlane(): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(1, 1);

  const mat = new THREE.MeshStandardMaterial({
    color: "black",
    transparent: true,
    opacity: 1,
    alphaTest: 0.5,
    depthWrite: false,
  });

  // hide the plane in the beauty pass, but still cast shadows
  mat.colorWrite = false;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = false;

  return mesh;
}
