// SceneCore/engine/camera.ts
import * as THREE from "three";

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 10, 12);
  camera.lookAt(0, 0, 0);
  return camera;
}

export function updateCameraOnResize(
  camera: THREE.PerspectiveCamera,
  renderer: THREE.WebGLRenderer
) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}
