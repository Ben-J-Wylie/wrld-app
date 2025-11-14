import * as THREE from "three";
import { SceneConfig, useSceneStore } from "../../SceneCore";

interface FitPerspectiveCameraOptions {
  onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
}

/**
 * applyFitPerspectiveCamera
 * ---------------------------------------------------------------------------
 * Vanilla Three.js version of your R3F FitPerspectiveCamera.
 */
export function applyFitPerspectiveCamera(
  engine: {
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    loop: { add: (fn: () => void) => void };
  },
  options: FitPerspectiveCameraOptions = {}
) {
  const { camera, renderer } = engine;
  const { onValuesChange } = options;

  // Zustand setters
  const setViewport = useSceneStore.getState().setViewport;
  const setVisibleHeight = useSceneStore.getState().setVisibleHeight;
  const setFov = useSceneStore.getState().setFov;

  // fovTarget must be widened to number to allow smoothing
  const fovTarget: { current: number } = {
    current: SceneConfig.camera.baseFov,
  };

  // -------------------------------------------------------
  // INITIAL COMPUTATION (runs once and on resize)
  // -------------------------------------------------------
  function computeAndApplyFov() {
    const w = window.innerWidth;
    const h = window.innerHeight || 1;
    const aspect = w / h;
    const distance = SceneConfig.camera.positionZ;

    // Always read sceneWidth from store (dynamic)
    const bgWidth =
      useSceneStore.getState().sceneWidth ??
      SceneConfig.scene.background.sceneWidth;

    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    fovTarget.current = fovDeg;
    camera.fov = fovDeg;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const visibleHeight =
      2 * distance * Math.tan((fovDeg * Math.PI) / 360);

    setViewport(w, h);
    setFov(fovDeg);
    setVisibleHeight(visibleHeight);
    onValuesChange?.({ fov: fovDeg, visibleHeight });
  }

  // Run once at setup
  computeAndApplyFov();

  // Listen for resize
  window.addEventListener("resize", computeAndApplyFov);

  // -------------------------------------------------------
  // PER-FRAME UPDATE (smooth interpolation)
  // -------------------------------------------------------
  engine.loop.add(() => {
    // If renderer hasn't sized yet, avoid divide-by-zero
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight || 1;

    const aspect = w / h;
    const distance = SceneConfig.camera.positionZ;

    // Always get up-to-date bgWidth (sceneWidth may change at runtime)
    const bgWidth =
      useSceneStore.getState().sceneWidth ??
      SceneConfig.scene.background.sceneWidth;

    const targetFov =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    // Smooth toward target (identical to R3F)
    fovTarget.current += (targetFov - fovTarget.current) * 0.1;

    camera.fov = fovTarget.current;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    const visibleHeight =
      2 * distance * Math.tan((camera.fov * Math.PI) / 360);

    setFov(camera.fov);
    setVisibleHeight(visibleHeight);
    onValuesChange?.({ fov: camera.fov, visibleHeight });
  });
}
