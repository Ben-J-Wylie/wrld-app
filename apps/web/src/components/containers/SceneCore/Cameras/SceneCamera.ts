// src/SceneCamera.ts
import * as THREE from "three";

export function createSceneCamera(width: number, height: number) {
  // ---------------------------------------------------------------------------
  // CREATE CAMERA (correct PerspectiveCamera signature)
  // ---------------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(
    45,              // fov
    width / height,  // aspect
    0.1,             // near
    100              // far
  );

  // --- POSITION --------------------------------------------------------------
  camera.position.set(0, 0, 20);

  // ---------------------------------------------------------------------------
  // FULL FRUSTUM / PROJECTION CONTROLS
  // ---------------------------------------------------------------------------

  // Vertical field of view
  camera.fov = 45;

  // Near & far planes
  camera.near = 0.1;
  camera.far = 100;

  // Aspect ratio
  camera.aspect = width / height;

  // Zoom (optical zoom, not distance)
  camera.zoom = 1.0; // >1 zooms in, <1 zooms out

  // Physical camera settings (more cinematic control)
  camera.filmGauge = 35; // mm sensor width
  camera.filmOffset = 0; // horizontal shift

  // Must rebuild the projection matrix after modifying frustum parameters
  camera.updateProjectionMatrix();

  // ---------------------------------------------------------------------------
  // CAMERA HELPER
  // ---------------------------------------------------------------------------
  const helper = new THREE.CameraHelper(camera);

  return { camera, helper };
}
