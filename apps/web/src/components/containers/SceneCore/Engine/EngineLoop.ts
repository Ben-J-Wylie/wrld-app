import * as THREE from "three";

export interface EngineLoopOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;

  /** Returns whichever camera is currently active */
  getCamera: () => THREE.PerspectiveCamera | null;

  /** Called every frame if SceneCamera is active */
  updateSceneCamera?: () => void;

  /** Called every frame if OrbitControls are active */
  updateOrbitControls?: () => void;

  /** Called every frame if scroll controller is active */
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

    // SceneCamera (adaptive FOV)
    if (updateSceneCamera) updateSceneCamera();

    // Orbit controls
    if (updateOrbitControls) updateOrbitControls();

    // Scroll controller
    if (updateScroll) updateScroll(dt);

    // 🔄 Ensure any camera helper attached to the active camera is updated
    const userData = camera.userData as any;
    const helper = userData?.helper as THREE.CameraHelper | undefined;
    if (helper) {
      helper.update();
    }

    // Render
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
