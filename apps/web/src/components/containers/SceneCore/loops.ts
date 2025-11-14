// SceneCore/engine/loop.ts
import * as THREE from "three";

export function createLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) {
  let running = false;

  function render() {
    if (!running) return;
    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }

  return {
    start() {
      running = true;
      render();
    },
    stop() {
      running = false;
    },
  };
}
