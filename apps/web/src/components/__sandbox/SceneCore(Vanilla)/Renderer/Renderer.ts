import * as THREE from "three";

/**
 * Creates and configures a WebGLRenderer with VSM shadows,
 * correct DPR, pointer events, and initial sizing.
 */
export function createRenderer(width: number, height: number) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });

  renderer.domElement.style.pointerEvents = "auto";
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(width, height);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  return renderer;
}
