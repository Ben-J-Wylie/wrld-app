// src/OrbitCamera.ts
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

export function createOrbitCamera(renderer: THREE.WebGLRenderer, width: number, height: number) {
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(10, 8, 15);

  // Orbit Controls
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.target.set(0, 0, 0);
  controls.update();

  // Helper
  const helper = new THREE.CameraHelper(camera);

  return { camera, controls, helper };
}