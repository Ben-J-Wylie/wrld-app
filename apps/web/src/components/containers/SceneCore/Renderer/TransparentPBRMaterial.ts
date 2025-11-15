import * as THREE from "three";

export function createAlphaPBRMaterial(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: false, // IMPORTANT
    alphaTest: 0.01, // your minimum threshold
    depthWrite: true, // write depth for shadows
    depthTest: true, // sort via depth buffer, not blending
  });

  // Override fragment shader
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      `#include <alphatest_fragment>`,
      `
        // CUSTOM ALPHA DISCARD — stable from all angles
        float alpha = texture2D(map, vUv).a;
        if (alpha < 0.01) discard;
      `
    );
  };

  return material;
}
