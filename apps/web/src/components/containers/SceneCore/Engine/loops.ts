// SceneCore/Engine/loops.ts
import * as THREE from "three";

export function createLoop(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
) {
  let running = false;
  const subscribers: Array<() => void> = [];

  function render() {
    if (!running) return;

    // Run all subscribed callbacks (like R3F useFrame)
    for (const fn of subscribers) {
      fn();
    }

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

    // ---- NEW: add frame subscriber ----
    add(fn: () => void) {
      subscribers.push(fn);
    },

    // optional but nice
    remove(fn: () => void) {
      const i = subscribers.indexOf(fn);
      if (i !== -1) subscribers.splice(i, 1);
    },
  };
}
