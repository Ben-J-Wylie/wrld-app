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
    45, // fov
    width / height, // aspect ratio  <-- IMPORTANT!
    1, // near
    6000 // far
  );

  // --- POSITION --------------------------------------------------------------
  camera.position.set(500, 300, 3000);

  // ---------------------------------------------------------------------------
  // FULL FRUSTUM CONTROLS
  // ---------------------------------------------------------------------------

  // FOV
  camera.fov = 45;

  // Near & far
  camera.near = 1;
  camera.far = 6000;

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
  controls.maxDistance = 5000;

  // Target
  controls.target.set(0, 0, 0);

  controls.update();

  // ---------------------------------------------------------------------------
  // CAMERA HELPER
  // ---------------------------------------------------------------------------
  const helper = new THREE.CameraHelper(camera);
  (camera.userData as any).helper = helper;

  return { camera, controls, helper };
}
