// src/SceneCamera.ts
import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createSceneCamera(renderer: THREE.WebGLRenderer) {
  const width = renderer.domElement.clientWidth;
  const height = renderer.domElement.clientHeight;

  // ---------------------------------------------------------------------------
  // CREATE CAMERA
  // ---------------------------------------------------------------------------
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);

  // Position camera
  const cameraZ = 100;
  camera.position.set(0, 0, cameraZ);

  let currentFov = camera.fov;

  // ---------------------------------------------------------------------------
  // FOV MATH — Fit Width
  // ---------------------------------------------------------------------------
  function computeFitWidthFov() {
    const sceneWidth = useSceneStore.getState().sceneWidth;

    const viewportW = renderer.domElement.clientWidth;
    const viewportH = renderer.domElement.clientHeight;
    const aspect = viewportW / viewportH;

    // Horizontal FOV needed to fit world width
    const fovX = 2 * Math.atan(sceneWidth / 2 / cameraZ);

    // Convert horizontal FOV → vertical FOV (Three.js uses vertical)
    const fovY = 2 * Math.atan(Math.tan(fovX / 2) / aspect);

    return THREE.MathUtils.radToDeg(fovY);
  }

  // ---------------------------------------------------------------------------
  // Instant update (used on resize or initial boot)
  // ---------------------------------------------------------------------------
  function updateInstant() {
    const fov = computeFitWidthFov();
    currentFov = fov;

    camera.fov = fov;
    camera.aspect =
      renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // Smooth update (optional, for animation per frame)
  // ---------------------------------------------------------------------------
  function updateSmooth() {
    const target = computeFitWidthFov();
    currentFov += (target - currentFov) * 0.1; // 10% lerp

    camera.fov = currentFov;
    camera.aspect =
      renderer.domElement.clientWidth / renderer.domElement.clientHeight;
    camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // Hook into window resizing
  // ---------------------------------------------------------------------------
  function onResize() {
    updateInstant();
  }

  window.addEventListener("resize", onResize);

  // Initial projection setup
  updateInstant();

  // Helper (optional)
  const helper = new THREE.CameraHelper(camera);

  return {
    camera,
    helper,
    updateSmooth,
    updateInstant,
    dispose() {
      window.removeEventListener("resize", onResize);
    },
  };
}
