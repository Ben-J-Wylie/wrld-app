// src/components/containers/SceneCore/Stage/StageSystem.ts
import React from "react";
import * as THREE from "three";
import { CSS3DRenderer } from "three-stdlib";

import { createRenderer } from "../Renderer/Renderer";
import { createEngineLoop } from "../Engine/EngineLoop";
import { createCameraPackage } from "../Cameras/CameraPackage";
import { applyScrollSystem } from "../Controllers/ScrollSystem";
import { applyBackdropSystem } from "../Layers/BackdropSystem";
import { createAmbientLight } from "../Lights/AmbientLight";
import { createDirectionalLight } from "../Lights/DirectionalLight";

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------
export interface StageDefinition {
  backdrop?: {
    presetSizes: {
      mobile: { width: number; height: number };
      tablet: { width: number; height: number };
      desktop: { width: number; height: number };
    };
    position?: [number, number, number];
    color?: THREE.ColorRepresentation;
  };
}

export interface StageAPI {
  scene: THREE.Scene;

  /** Root for screen-space UI, parented under the SceneCamera. */
  getCameraRoot(): THREE.Group;

  /** The *main* scene camera (backdrop-fitting, HUD-anchoring). */
  getSceneCamera(): THREE.PerspectiveCamera;

  /** The currently active render camera (Scene or Orbit). */
  getCamera(): THREE.PerspectiveCamera;

  /** NEW — viewport size used for responsive breakpoints */
  getViewportWidth(): number;
  getViewportHeight(): number;

  onResizeOrFovChange(cb: () => void): () => void;

  // Hierarchy grouping
  pushParent(obj: THREE.Object3D): void;
  popParent(): void;
  getActiveParent(): THREE.Object3D;

  // Object lifecycle (WebGL)
  addObject(obj: THREE.Object3D, explicitParent?: THREE.Object3D | null): void;
  removeObject(
    obj: THREE.Object3D,
    explicitParent?: THREE.Object3D | null
  ): void;

  // NEW: CSS3D object lifecycle
  addCSSObject(obj: THREE.Object3D): void;
  removeCSSObject(obj: THREE.Object3D): void;

  // (Debug / advanced)
  getCSSScene(): THREE.Scene;

  // Interaction (WebGL raycaster)
  registerInteractive(
    obj: THREE.Object3D,
    handlers: {
      onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
      onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
    }
  ): void;

  unregisterInteractive(obj: THREE.Object3D): void;

  // Backdrop API
  setBackdropColor(color: THREE.ColorRepresentation): void;
  setBackdropPosition(pos: [number, number, number]): void;
  setBackdropSize(width: number, height: number): void;
  getBackdropMesh(): THREE.Mesh | null;

  cleanup(): void;
}

// ---------------------------------------------------------
// FACTORY FUNCTION: createStage()
// ---------------------------------------------------------
export function createStage(
  container: HTMLElement,
  definition: StageDefinition
): StageAPI {
  // ---------------------------------------------------------
  // RENDERERS
  // ---------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  // WebGL renderer
  const renderer = createRenderer(width, height);
  renderer.domElement.style.pointerEvents = "auto";
  renderer.domElement.style.position = "absolute";
  renderer.domElement.style.inset = "0";

  // CSS3D renderer (DOM layer)
  const cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(width, height);
  cssRenderer.domElement.style.position = "absolute";
  cssRenderer.domElement.style.inset = "0";
  // Important: let DOM elements themselves decide pointer-events
  cssRenderer.domElement.style.pointerEvents = "none";

  // Append WebGL first, CSS3D above it
  container.appendChild(renderer.domElement);
  container.appendChild(cssRenderer.domElement);

  // ---------------------------------------------------------
  // SCENES
  // ---------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

  // NEW: separate CSS3D scene
  const cssScene = new THREE.Scene();

  // ---------------------------------------------------------
  // LIGHTS
  // ---------------------------------------------------------
  scene.add(createAmbientLight());
  scene.add(createDirectionalLight());

  // ---------------------------------------------------------
  // CAMERA PACKAGE
  // ---------------------------------------------------------
  const cams = createCameraPackage(renderer, scene, width, height);
  let activeCamera = cams.activeCamera;

  // Toggle orbit camera with "C" (render camera only)
  window.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "c") {
      activeCamera = cams.cameraSwitcher();
    }
  });

  // ---------------------------------------------------------
  // SCROLL SYSTEM
  // ---------------------------------------------------------
  const scrollSystem = applyScrollSystem(cams.cameraRig, renderer.domElement);

  // ---------------------------------------------------------
  // INTERACTION SYSTEM (WebGL raycaster only)
  // ---------------------------------------------------------
  const interactiveObjects = new Set<THREE.Object3D>();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function updatePointer(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  // CLICK
  renderer.domElement.addEventListener("pointerdown", (e) => {
    updatePointer(e);
    raycaster.setFromCamera(pointer, activeCamera);

    const hits = raycaster.intersectObjects([...interactiveObjects], true);
    if (hits.length > 0) {
      const h = hits[0];
      h.object.userData.handlers?.onClick?.(e, h);
    }
  });

  // HOVER
  renderer.domElement.addEventListener("pointermove", (e) => {
    updatePointer(e);
    raycaster.setFromCamera(pointer, activeCamera);

    const hits = raycaster.intersectObjects([...interactiveObjects], true);

    for (const obj of interactiveObjects) {
      const hovered = hits.find((h) => h.object === obj);
      obj.userData.handlers?.onHover?.(e, hovered);
    }
  });

  // ---------------------------------------------------------
  // BACKDROP SYSTEM
  // ---------------------------------------------------------
  const backdropSystem = definition.backdrop
    ? applyBackdropSystem({
        scene,
        presetSizes: definition.backdrop.presetSizes,
        updateSceneCamera: cams.updateSceneCameraInstant,
        cameraRig: cams.cameraRig,
        position: definition.backdrop.position ?? [0, 0, 0],
        color: definition.backdrop.color,
      })
    : null;

  const setBackdropColor = (color: THREE.ColorRepresentation) => {
    if (!backdropSystem) return;
    const mat = backdropSystem.mesh.material as THREE.MeshStandardMaterial;
    mat.color.set(color);
  };

  const setBackdropPosition = (pos: [number, number, number]) => {
    if (!backdropSystem) return;
    backdropSystem.mesh.position.set(...pos);
  };

  const setBackdropSize = (width: number, height: number) => {
    if (!backdropSystem) return;
    backdropSystem.resize(width, height);
  };

  const getBackdropMesh = () => {
    return backdropSystem?.mesh ?? null;
  };

  // ---------------------------------------------------------
  // PARENT STACK (WebGL scene graph)
  // ---------------------------------------------------------
  const parentStack: THREE.Object3D[] = [scene];

  function pushParent(obj: THREE.Object3D) {
    parentStack.push(obj);
  }

  function popParent() {
    if (parentStack.length > 1) parentStack.pop();
  }

  function getActiveParent() {
    return parentStack[parentStack.length - 1];
  }

  // ---------------------------------------------------------
  // DYNAMIC OBJECTS (WebGL)
  // ---------------------------------------------------------
  const dynamicObjects = new Set<THREE.Object3D>();

  function addObject(
    obj: THREE.Object3D,
    explicitParent?: THREE.Object3D | null
  ) {
    const parent = explicitParent ?? getActiveParent();
    parent.add(obj);
    dynamicObjects.add(obj);
  }

  function removeObject(obj: THREE.Object3D) {
    obj.parent?.remove(obj);
    dynamicObjects.delete(obj);
  }

  // ---------------------------------------------------------
  // CSS3D OBJECTS
  // ---------------------------------------------------------
  function addCSSObject(obj: THREE.Object3D) {
    cssScene.add(obj);
  }

  function removeCSSObject(obj: THREE.Object3D) {
    cssScene.remove(obj);
  }

  function getCSSScene() {
    return cssScene;
  }

  // ---------------------------------------------------------
  // RESIZE / FOV CHANGE SUBSCRIBERS
  // ---------------------------------------------------------
  const fovListeners = new Set<() => void>();

  function onResizeOrFovChange(cb: () => void) {
    fovListeners.add(cb);
    return () => fovListeners.delete(cb);
  }

  function emitResizeOrFov() {
    for (const cb of fovListeners) cb();
  }

  // ---------------------------------------------------------
  // RESIZE HANDLER
  // ---------------------------------------------------------
  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);
    cssRenderer.setSize(width, height);

    const cam = activeCamera as THREE.PerspectiveCamera;
    cam.aspect = width / height;
    cam.updateProjectionMatrix();

    // Re-fit SceneCamera to backdrop & update rig
    cams.updateSceneCameraInstant();
    cams.cameraRig.onResizeOrFovChange();

    // 🔥 Notify HUD / ScreenGroups that the frustum changed
    emitResizeOrFov();
  });

  // ---------------------------------------------------------
  // ENGINE LOOP
  // ---------------------------------------------------------
  const engine = createEngineLoop({
    renderer,
    scene,
    cssRenderer,
    cssScene,
    getCamera: () => activeCamera,
    updateSceneCamera: () => {
      if (activeCamera === cams.sceneCamera) {
        const prevFov = cams.sceneCamera.fov;
        cams.updateSceneCameraSmooth();
        if (cams.sceneCamera.fov !== prevFov) {
          // 🔥 FOV changed this frame → notify listeners
          emitResizeOrFov();
        }
      }
    },
    updateOrbitControls: () =>
      activeCamera === cams.orbitCamera ? cams.controls.update() : undefined,
    updateScroll: (dt) =>
      activeCamera === cams.sceneCamera
        ? scrollSystem.scroll.update(dt)
        : undefined,
  });

  engine.start();

  // ---------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------
  function cleanup() {
    engine.stop();
    scrollSystem.scroll.stop();
    backdropSystem?.cleanup();
    fovListeners.clear();

    // Remove renderers from DOM
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement);
    }
    if (cssRenderer.domElement.parentElement === container) {
      container.removeChild(cssRenderer.domElement);
    }
  }

  // ---------------------------------------------------------
  // CAMERA ACCESSORS
  // ---------------------------------------------------------
  function getCamera() {
    return activeCamera as THREE.PerspectiveCamera;
  }

  function getSceneCamera() {
    return cams.sceneCamera;
  }

  function getViewportWidth() {
    return container.clientWidth;
  }

  function getViewportHeight() {
    return container.clientHeight;
  }

  // ---------------------------------------------------------
  // RETURN PUBLIC API
  // ---------------------------------------------------------
  return {
    scene,

    getCameraRoot: () => cams.cameraRoot,
    getSceneCamera,
    getCamera,

    getViewportWidth,
    getViewportHeight,

    onResizeOrFovChange,

    pushParent,
    popParent,
    getActiveParent,

    addObject,
    removeObject,

    addCSSObject,
    removeCSSObject,
    getCSSScene,

    registerInteractive(obj, handlers) {
      obj.userData.handlers = handlers;
      interactiveObjects.add(obj);
    },

    unregisterInteractive(obj) {
      interactiveObjects.delete(obj);
      delete obj.userData.handlers;
    },

    setBackdropColor,
    setBackdropPosition,
    setBackdropSize,
    getBackdropMesh,

    cleanup,
  };
}
