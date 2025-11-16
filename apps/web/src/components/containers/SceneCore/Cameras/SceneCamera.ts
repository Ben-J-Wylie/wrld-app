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

  const helper = new THREE.CameraHelper(camera);

  let currentFov = camera.fov;

  // ------------------------------------------------------------
  // ADAPTIVE FOV:
  // - If viewport is wide relative to backdrop: fit WIDTH.
  // - If viewport is tall relative to backdrop: fit HEIGHT.
  // In both cases, never show outside the backdrop.
  // ------------------------------------------------------------
  function computeAdaptiveFov() {
    const { sceneWidth: W, sceneHeight: H } = useSceneStore.getState();
    const { w, h } = getViewport();
    const aspect = w / h;

    if (W <= 0 || H <= 0 || aspect <= 0) {
      return camera.fov; // fallback: keep current
    }

    const bgAspect = W / H;

    let fovY: number;

    if (aspect >= bgAspect) {
      // Viewport is as wide or wider than the backdrop.
      // Fit WIDTH so left/right align with backdrop.
      const fovX = 2 * Math.atan(W / 2 / cameraZ);
      fovY = 2 * Math.atan(Math.tan(fovX / 2) / aspect);
    } else {
      // Viewport is narrower (taller) than the backdrop.
      // Fit HEIGHT so top/bottom align with backdrop,
      // and let the sides collapse inward.
      fovY = 2 * Math.atan(H / 2 / cameraZ);
    }

    return THREE.MathUtils.radToDeg(fovY);
  }

  function updateInstant() {
    const { w, h } = getViewport();

    const fov = computeAdaptiveFov();
    currentFov = fov;

    camera.fov = fov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    helper.update();
  }

  function updateSmooth() {
    const { w, h } = getViewport();

    const target = computeAdaptiveFov();

    // Lerp speed — tweak for snappier or smoother
    const speed = 0.2;
    currentFov += (target - currentFov) * speed;

    camera.fov = currentFov;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    helper.update();
  }

  // React to changes in scene dimensions
  useSceneStore.subscribe((state, prev) => {
    if (
      state.sceneWidth !== prev.sceneWidth ||
      state.sceneHeight !== prev.sceneHeight
    ) {
      updateInstant();
    }
  });

  // Initial setup
  updateInstant();

  return {
    camera,
    helper,
    updateSmooth,
    updateInstant,
  };
}
