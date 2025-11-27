import * as THREE from "three";

let sceneCamera: THREE.PerspectiveCamera | null = null;

export function registerSceneCamera(cam: THREE.PerspectiveCamera) {
  sceneCamera = cam;
}

export function getSceneCamera() {
  return sceneCamera;
}
