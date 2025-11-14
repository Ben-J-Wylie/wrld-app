// SceneCore/engine/three-engine.ts
import * as THREE from "three";
import { createRenderer } from "./renderer";
import { createCamera, updateCameraOnResize } from "./camera";
import { createLights } from "./lights";
import { createLoop } from "./loops";

export class ThreeEngine {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  loop: ReturnType<typeof createLoop>;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // --- core scene ---
    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.renderer = createRenderer(canvas);

    // --- lights ---
    createLights(this.scene);

    // --- render loop ---
    this.loop = createLoop(this.renderer, this.scene, this.camera);

    // --- resize hook ---
    window.addEventListener("resize", () =>
      updateCameraOnResize(this.camera, this.renderer)
    );

    updateCameraOnResize(this.camera, this.renderer);
  }

  start() {
    this.loop.start();
  }

  stop() {
    this.loop.stop();
  }
}
