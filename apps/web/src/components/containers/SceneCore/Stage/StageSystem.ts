// StageSystem.ts
import React from "react";
import * as THREE from "three";

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

  // Hierarchy grouping
  pushParent(obj: THREE.Object3D): void;
  popParent(): void;
  getActiveParent(): THREE.Object3D;

  // Object lifecycle
  addObject(obj: THREE.Object3D): void;
  removeObject(obj: THREE.Object3D): void;

  // Interaction
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

  injectChildrenInto(_ignored: any, children: React.ReactNode): React.ReactNode;
}

// ---------------------------------------------------------
// FACTORY FUNCTION: createStage()
// ---------------------------------------------------------
export function createStage(
  container: HTMLElement,
  definition: StageDefinition
): StageAPI {
  // ---------------------------------------------------------
  // RENDERER
  // ---------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = createRenderer(width, height);
  renderer.domElement.style.pointerEvents = "auto";
  container.appendChild(renderer.domElement);

  // ---------------------------------------------------------
  // SCENE
  // ---------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x202020);

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

  // Toggle orbit camera with "C"
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
  // INTERACTION SYSTEM
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

  // Expose backdrop API wrappers:
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
  // PARENT STACK
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
  // DYNAMIC OBJECTS
  // ---------------------------------------------------------
  const dynamicObjects = new Set<THREE.Object3D>();

  function addObject(obj: THREE.Object3D) {
    getActiveParent().add(obj);
    dynamicObjects.add(obj);
  }

  function removeObject(obj: THREE.Object3D) {
    obj.parent?.remove(obj);
    dynamicObjects.delete(obj);
  }

  // ---------------------------------------------------------
  // RESIZE HANDLER
  // ---------------------------------------------------------
  window.addEventListener("resize", () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);

    const cam = activeCamera as THREE.PerspectiveCamera;
    cam.aspect = width / height;
    cam.updateProjectionMatrix();

    cams.updateSceneCameraInstant();
    cams.cameraRig.onResizeOrFovChange();
  });

  // ---------------------------------------------------------
  // ENGINE LOOP
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // CLEANUP
  // ---------------------------------------------------------
  function cleanup() {
    engine.stop();
    scrollSystem.scroll.stop();
    backdropSystem?.cleanup();
  }

  // ---------------------------------------------------------
  // RETURN PUBLIC API
  // ---------------------------------------------------------
  return {
    scene,

    pushParent,
    popParent,
    getActiveParent,

    addObject,
    removeObject,

    registerInteractive(obj, handlers) {
      obj.userData.handlers = handlers;
      interactiveObjects.add(obj);
    },

    unregisterInteractive(obj) {
      interactiveObjects.delete(obj);
      delete obj.userData.handlers;
    },

    // BACKDROP API
    setBackdropColor,
    setBackdropPosition,
    setBackdropSize,
    getBackdropMesh,

    // React injection passthrough
    injectChildrenInto(_unused, children) {
      return children;
    },

    cleanup,
  };
}
