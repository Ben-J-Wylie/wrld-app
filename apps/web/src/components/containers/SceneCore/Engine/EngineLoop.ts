import * as THREE from "three";

export interface EngineLoopOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera | null;

  updateSceneCamera?: () => void;
  updateOrbitControls?: () => void;
  updateScroll?: (dt: number) => void;
}

export function createEngineLoop(options: EngineLoopOptions) {
  const {
    renderer,
    scene,
    getCamera,
    updateSceneCamera,
    updateOrbitControls,
    updateScroll,
  } = options;

  let frameId: number | null = null;
  let lastTime = performance.now();

  const animate = () => {
    frameId = requestAnimationFrame(animate);

    const now = performance.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const camera = getCamera();
    if (!camera) return;

    // -------------------------------------------------------
    // UPDATE SCENE CAMERA (adaptive FOV)
    // -------------------------------------------------------
    if (updateSceneCamera) {
      updateSceneCamera();
    }

    // -------------------------------------------------------
    // UPDATE ORBIT CONTROLS
    // -------------------------------------------------------
    if (updateOrbitControls) {
      updateOrbitControls();
    }

    // -------------------------------------------------------
    // UPDATE SCROLL CONTROLLER
    // -------------------------------------------------------
    if (updateScroll) {
      updateScroll(dt);
    }

    // Camera helper
    const userData = camera.userData as any;
    const helper = userData?.helper as THREE.CameraHelper | undefined;
    if (helper) {
      helper.update();
    }

    renderer.render(scene, camera);
  };

  return {
    start() {
      if (!frameId) {
        lastTime = performance.now();

        animate();
      }
    },

    stop() {
      if (frameId) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    },
  };
}
