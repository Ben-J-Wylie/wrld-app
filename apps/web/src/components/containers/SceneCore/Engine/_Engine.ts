// Engine.ts
import * as THREE from "three";
import { createSceneCamera } from "../Cameras/SceneCamera";

export class ThreeEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;

  // extra camera utilities provided by createSceneCamera
  cameraHelper: THREE.CameraHelper;
  updateCameraInstant: () => void;
  updateCameraSmooth: () => void;

  // loop system
  private callbacks: ((dt: number) => void)[] = [];
  private last = 0;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(width, height);

    this.scene = new THREE.Scene();

    // --------------------------------------------------------------
    // Correct usage: createSceneCamera returns an object CONTAINING
    // the camera + helper + fov update functions.
    // --------------------------------------------------------------
    const sceneCamera = createSceneCamera(this.renderer);

    // Extract the actual Three.js camera
    this.camera = sceneCamera.camera;

    // Save helper + update functions for external use
    this.cameraHelper = sceneCamera.helper;
    this.updateCameraInstant = sceneCamera.updateInstant;
    this.updateCameraSmooth = sceneCamera.updateSmooth;

    // Add camera helper to scene (optional)
    // this.scene.add(this.cameraHelper);
  }

  // ----------------------------------------------------------------------------
  // Loop API
  // ----------------------------------------------------------------------------
  addToLoop(fn: (dt: number) => void) {
    this.callbacks.push(fn);
  }

  // ----------------------------------------------------------------------------
  // Render Loop (only runs after start())
  // ----------------------------------------------------------------------------
  private tick = () => {
    if (!this.running) return;

    const now = performance.now();
    const dt = (now - this.last) / 1000;
    this.last = now;

    // Run plugin callbacks (scroll, camera rig, animations, etc.)
    for (const fn of this.callbacks) fn(dt);

    // Render
    this.renderer.render(this.scene, this.camera);

    requestAnimationFrame(this.tick);
  };

  // ----------------------------------------------------------------------------
  // Start Engine
  // ----------------------------------------------------------------------------
  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
  }
}
