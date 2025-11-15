// src/components/containers/SceneCore/Cameras/SceneCamera.ts
import * as THREE from "three";
import { useSceneStore } from "../Store/SceneStore";

export function createSceneCamera(renderer: THREE.WebGLRenderer) {
  const cameraZ = 100;

  const getViewport = () => ({
    w: renderer.domElement.clientWidth,
    h: renderer.domElement.clientHeight,
  });

  const { w, h } = getViewport();

  const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 110);
  camera.position.set(0, 0, cameraZ);

  // CameraHelper (debug view of frustum)
  const helper = new THREE.CameraHelper(camera);

  let currentFov = camera.fov;

  // ------------------------------------------------------------
  // FIT WIDTH MATH
  // ------------------------------------------------------------
  function computeFitWidthFov() {
    const sceneWidth = useSceneStore.getState().sceneWidth;
    const { w, h } = getViewport();
    const aspect = w / h;

    const fovX = 2 * Math.atan(sceneWidth / 2 / cameraZ);
    const fovY = 2 * Math.atan(Math.tan(fovX / 2) / aspect);

    return THREE.MathUtils.radToDeg(fovY);
  }

  // Instant update (on resize or store immediately)
  function updateInstant() {
    const { w, h } = getViewport();
    const fov = computeFitWidthFov();
    currentFov = fov;

    camera.fov = fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    helper.update();
  }

  // Smooth update (every frame)
  function updateSmooth() {
    const { w, h } = getViewport();
    const target = computeFitWidthFov();

    currentFov += (target - currentFov) * 1;

    camera.fov = currentFov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    helper.update();
  }

  // Store subscription → dynamic FOV
  useSceneStore.subscribe((state, prev) => {
    if (state.sceneWidth !== prev.sceneWidth) updateInstant();
  });

  // Initial update
  updateInstant();

  return {
    camera,
    helper,
    updateSmooth,
    updateInstant,
  };
}
