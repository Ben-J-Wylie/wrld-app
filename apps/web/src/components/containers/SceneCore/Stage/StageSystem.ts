import React from "react";
import * as THREE from "three";

import { createRenderer } from "../Renderer/Renderer";
import { createEngineLoop } from "../Engine/EngineLoop";
import { createCameraPackage } from "../Cameras/CameraPackage";
import { applyScrollSystem } from "../Controllers/ScrollSystem";
import { applyBackdropSystem } from "../Layers/BackdropSystem";
import { createAmbientLight } from "../Lights/AmbientLight";
import { createDirectionalLight } from "../Lights/DirectionalLight";

export interface StageDefinition {
  backdrop?: {
    presetSizes: any;
    position?: [number, number, number];
  };
}

export interface StageAPI {
  scene: THREE.Scene;

  pushParent: (obj: THREE.Object3D) => void;
  popParent: () => void;
  getActiveParent: () => THREE.Object3D;

  addObject: (obj: THREE.Object3D) => void;
  removeObject: (obj: THREE.Object3D) => void;

  registerInteractive: (
    obj: THREE.Object3D,
    handlers: {
      onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
      onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
    }
  ) => void;

  unregisterInteractive: (obj: THREE.Object3D) => void;

  cleanup: () => void;

  // React child injector now NO LONGER mutates props
  injectChildrenInto: (
    _ignored: any,
    children: React.ReactNode
  ) => React.ReactNode;
}

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
  // CAMERAS + CAMERA RIG
  // ---------------------------------------------------------
  const cams = createCameraPackage(renderer, scene, width, height);
  let activeCamera = cams.activeCamera;

  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() === "c") {
      activeCamera = cams.cameraSwitcher();
    }
  };
  window.addEventListener("keydown", onKey);

  // ---------------------------------------------------------
  // SCROLL SYSTEM
  // ---------------------------------------------------------
  const scrollSystem = applyScrollSystem(cams.cameraRig, renderer.domElement);

  // ---------------------------------------------------------
  // INTERACTION SYSTEM (NEW)
  // ---------------------------------------------------------
  const interactiveObjects = new Set<THREE.Object3D>();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function registerInteractive(
    obj: THREE.Object3D,
    handlers: { onClick?: any; onHover?: any }
  ) {
    obj.userData.handlers = handlers;
    interactiveObjects.add(obj);
  }

  function unregisterInteractive(obj: THREE.Object3D) {
    interactiveObjects.delete(obj);
    delete obj.userData.handlers;
  }

  function updatePointer(event: PointerEvent) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onPointerDown(e: PointerEvent) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, activeCamera);

    const hits = raycaster.intersectObjects([...interactiveObjects], true);
    if (hits.length > 0) {
      hits[0].object.userData.handlers?.onClick?.(e, hits[0]);
    }
  }

  function onPointerMove(e: PointerEvent) {
    updatePointer(e);
    raycaster.setFromCamera(pointer, activeCamera);

    const hits = raycaster.intersectObjects([...interactiveObjects], true);

    for (const obj of interactiveObjects) {
      const hovered = hits.find((h) => h.object === obj);
      obj.userData.handlers?.onHover?.(e, hovered);
    }
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointermove", onPointerMove);

  // ---------------------------------------------------------
  // BACKDROP
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // PARENT STACK (NEW — replaces __parent)
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
    const parent = getActiveParent();
    parent.add(obj);
    dynamicObjects.add(obj);
  }

  function removeObject(obj: THREE.Object3D) {
    if (obj.parent) obj.parent.remove(obj);
    dynamicObjects.delete(obj);
  }

  // ---------------------------------------------------------
  // NEW injectChildrenInto — no __parent mutation
  // ---------------------------------------------------------
  function injectChildrenInto(_unused: any, children: React.ReactNode) {
    return children;
  }

  // ---------------------------------------------------------
  // RESIZE
  // ---------------------------------------------------------
  const onResize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);

    activeCamera.aspect = width / height;
    activeCamera.updateProjectionMatrix();

    cams.updateSceneCameraInstant();
    cams.cameraRig.onResizeOrFovChange();
  };

  window.addEventListener("resize", onResize);

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

    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKey);

    renderer.domElement.removeEventListener("pointerdown", onPointerDown);
    renderer.domElement.removeEventListener("pointermove", onPointerMove);

    backdropSystem?.cleanup();
    dynamicObjects.clear();
    interactiveObjects.clear();
  }
  // ---------------------------------------------------------
  // API RETURN
  // ---------------------------------------------------------
  return {
    scene,
    pushParent,
    popParent,
    getActiveParent,

    addObject,
    removeObject,

    registerInteractive,
    unregisterInteractive,

    injectChildrenInto,
    cleanup,
  };
}
