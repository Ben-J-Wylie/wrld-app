import * as THREE from "three";

import { createRenderer } from "../Renderer/Renderer";
import { createEngineLoop } from "../Engine/EngineLoop";

import { createCameraPackage } from "../Cameras/CameraPackage";
import { applyScrollSystem } from "../Controllers/ScrollSystem";

import { applyBackdropSystem } from "../Layers/BackdropSystem";
import { applySceneObjects } from "../Layers/SceneObjectsSystem";

import { createAmbientLight } from "../Lights/AmbientLight";
import { createDirectionalLight } from "../Lights/DirectionalLight";

export interface StageDefinition {
  backdrop?: {
    presetSizes: any;
    position?: [number, number, number];
  };

  objects?: any[];
}

export interface Stage {
  cleanup: () => void;
}

export function createStage(
  container: HTMLElement,
  definition: StageDefinition
): Stage {
  // -------------------------------------------------------------------
  // RENDERER
  // -------------------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = createRenderer(width, height);
  container.appendChild(renderer.domElement);

  // -------------------------------------------------------------------
  // SCENE
  // -------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // -------------------------------------------------------------------
  // LIGHTS
  // -------------------------------------------------------------------
  scene.add(createAmbientLight());
  scene.add(createDirectionalLight());

  // -------------------------------------------------------------------
  // CAMERAS + CAMERA RIG
  // -------------------------------------------------------------------
  const cams = createCameraPackage(renderer, scene, width, height);

  let activeCamera = cams.activeCamera;

  // Toggle SceneCamera <-> OrbitCamera
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "c") {
      activeCamera = cams.cameraSwitcher();
    }
  };
  window.addEventListener("keydown", onKey);

  // -------------------------------------------------------------------
  // SCROLL
  // -------------------------------------------------------------------
  const scrollSystem = applyScrollSystem(cams.cameraRig, renderer.domElement);

  // -------------------------------------------------------------------
  // BACKDROP
  // -------------------------------------------------------------------
  let backdropSystem: any = null;

  if (definition.backdrop) {
    backdropSystem = applyBackdropSystem({
      scene,
      presetSizes: definition.backdrop.presetSizes,
      updateSceneCamera: cams.updateSceneCameraInstant,
      cameraRig: cams.cameraRig,
      position: definition.backdrop.position ?? [0, 0, 0],
    });
  }

  // -------------------------------------------------------------------
  // OBJECTS
  // -------------------------------------------------------------------
  let objectsSystem: any = null;

  if (definition.objects) {
    objectsSystem = applySceneObjects({
      scene,
      objects: definition.objects,
    });
  }

  // -------------------------------------------------------------------
  // RESIZE HANDLER — CRITICAL FOR DYNAMIC FOV + CAMERA RIG
  // -------------------------------------------------------------------
  const onResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);

    // Only update active camera
    activeCamera.aspect = width / height;
    activeCamera.updateProjectionMatrix();

    // Recompute dynamic-fit FOV
    cams.updateSceneCameraInstant();

    // Refresh scroll boundaries in rig
    cams.cameraRig.onResizeOrFovChange();
  };

  window.addEventListener("resize", onResize);

  // -------------------------------------------------------------------
  // ENGINE LOOP
  // -------------------------------------------------------------------
  const engine = createEngineLoop({
    renderer,
    scene,
    getCamera: () => activeCamera,

    updateSceneCamera: () =>
      activeCamera === cams.sceneCamera
        ? cams.updateSceneCameraSmooth()
        : undefined,

    updateOrbitControls: () =>
      activeCamera === cams.orbitCamera ? cams.controls.update() : undefined,

    updateScroll: (dt) =>
      activeCamera === cams.sceneCamera
        ? scrollSystem.scroll.update(dt)
        : undefined,
  });

  engine.start();

  // -------------------------------------------------------------------
  // CLEANUP
  // -------------------------------------------------------------------
  return {
    cleanup() {
      engine.stop();

      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);

      scrollSystem.scroll.stop();
      backdropSystem?.cleanup();
      objectsSystem?.cleanup();
    },
  };
}
