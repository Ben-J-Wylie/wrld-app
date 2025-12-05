// utilOpaqueWhiteTex.ts
import * as THREE from "three";

export const opaqueWhiteTex = (() => {
  const data = new Uint8Array([255, 255, 255, 255]); // RGBA = opaque white
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
})();
