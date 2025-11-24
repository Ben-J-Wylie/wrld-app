// src/components/containers/SceneCore/Engine/EngineLoop.ts
import * as THREE from "three";
import type { CSS3DRenderer } from "three-stdlib";

export interface EngineLoopOptions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  getCamera: () => THREE.PerspectiveCamera | null;

  // NEW: optional CSS3D layer
  cssRenderer?: CSS3DRenderer;
  cssScene?: THREE.Scene | null;

  updateSceneCamera?: () => void;
  updateOrbitControls?: () => void;
  updateScroll?: (dt: number) => void;
}

export function createEngineLoop(options: EngineLoopOptions) {
  const {
    renderer,
    scene,
    getCamera,
    cssRenderer,
    cssScene,
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

    // -------------------------------------------------------
    // RENDER PIPELINE
    // -------------------------------------------------------
    renderer.render(scene, camera);

    if (cssRenderer && cssScene) {
      cssRenderer.render(cssScene, camera);
    }
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
