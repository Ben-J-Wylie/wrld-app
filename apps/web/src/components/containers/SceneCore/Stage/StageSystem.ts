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
  scene: THREE.Scene; // ← ADD THIS
  addObject: (obj: THREE.Object3D, parent?: THREE.Object3D | null) => void;
  removeObject: (obj: THREE.Object3D) => void;
  injectChildrenInto: (
    parentRef: React.RefObject<THREE.Object3D | null>,
    children: React.ReactNode
  ) => any;
  cleanup: () => void;
}

export function createStage(
  container: HTMLElement,
  definition: StageDefinition
): StageAPI {
  console.log("=== createStage() INITIALIZE ===");

  // ---------------------------------------------------------
  // RENDERER
  // ---------------------------------------------------------
  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = createRenderer(width, height);
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
  // REACT-DRIVEN DYNAMIC OBJECT REGISTRY
  // ---------------------------------------------------------
  const dynamicObjects = new Set<THREE.Object3D>();

  function addObject(obj: THREE.Object3D, parent?: THREE.Object3D | null) {
    console.log("addObject() called:", obj);
    console.log("requested parent:", parent);

    if (parent) {
      console.log("→ parent.add(obj)");
      parent.add(obj);
    } else {
      console.log("→ scene.add(obj)");
      scene.add(obj);
    }

    console.log("final obj.parent:", obj.parent);
    dynamicObjects.add(obj);
  }

  function removeObject(obj: THREE.Object3D) {
    console.log("removeObject():", obj);
    if (obj.parent) {
      obj.parent.remove(obj);
    }
    dynamicObjects.delete(obj);
  }

  function injectChildrenInto(parentRef: React.RefObject<any>, children: any) {
    console.log("injectChildrenInto()");
    console.log("parentRef.current:", parentRef.current);
    console.log("children being injected:", children);

    return React.Children.map(children, (child: any) => {
      if (!child) return null;

      console.log("→ cloning child:", child);
      console.log("→ injecting __parent:", parentRef.current);

      return React.cloneElement(child, {
        __parent: parentRef.current,
      });
    });
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
    console.log("cleanup()");
    engine.stop();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("keydown", onKey);

    scrollSystem.scroll.stop();
    backdropSystem?.cleanup();

    dynamicObjects.forEach((obj) => {
      if (obj.parent) obj.parent.remove(obj);
    });
    dynamicObjects.clear();
  }

  // ---------------------------------------------------------
  // API Return
  // ---------------------------------------------------------
  return {
    scene,
    addObject,
    removeObject,
    injectChildrenInto,
    cleanup,
  };
}
