// src/SceneCamera.ts
import * as THREE from "three";

export function createSceneCamera(width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, 20);

  // Helper
  const helper = new THREE.CameraHelper(camera);

  return { camera, helper };
}