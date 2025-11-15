// src/OrbitCamera.ts
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

export function createOrbitCamera(
  renderer: THREE.WebGLRenderer,
  width: number,
  height: number
) {
  // ---------------------------------------------------------------------------
  // CREATE CAMERA (correct constructor usage)
  // ---------------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(
    45,              // fov
    width / height,  // aspect ratio  <-- IMPORTANT!
    0.1,             // near
    100              // far
  );

  // --- POSITION --------------------------------------------------------------
  camera.position.set(10, 8, 15);

  // ---------------------------------------------------------------------------
  // FULL FRUSTUM CONTROLS
  // ---------------------------------------------------------------------------

  // FOV
  camera.fov = 45;

  // Near & far
  camera.near = 0.1;
  camera.far = 500;

  // Aspect
  camera.aspect = width / height;

  // Zoom
  camera.zoom = 1;

  // Cinematic / physical settings
  camera.filmGauge = 35;
  camera.filmOffset = 0;

  // Rebuild frustum
  camera.updateProjectionMatrix();

  // ---------------------------------------------------------------------------
  // ORBIT CONTROLS
  // ---------------------------------------------------------------------------
  const controls = new OrbitControls(camera, renderer.domElement);

  controls.enabled = true;

  // Smooth motion
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  // Pan
  controls.enablePan = true;
  controls.panSpeed = 1.0;

  // Zoom
  controls.enableZoom = true;
  controls.zoomSpeed = 1.0;

  // Distance limits
  controls.minDistance = 1;
  controls.maxDistance = 200;

  // Target
  controls.target.set(0, 0, 0);

  controls.update();

  // ---------------------------------------------------------------------------
  // CAMERA HELPER
  // ---------------------------------------------------------------------------
  const helper = new THREE.CameraHelper(camera);

  return { camera, controls, helper };
}
