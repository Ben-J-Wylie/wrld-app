// src/components/containers/SceneCore/Cameras/createCameraPackage.ts
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

import { createSceneCamera } from "./SceneCamera";
import { createCameraRig } from "./CameraRig";
import { createOrbitCamera } from "./OrbitCamera";
import { useSceneStore } from "../Store/SceneStore";

export interface CameraPackage {
  sceneCamera: THREE.PerspectiveCamera;
  orbitCamera: THREE.PerspectiveCamera;

  activeCamera: THREE.PerspectiveCamera;

  controls: OrbitControls;

  updateSceneCameraSmooth: () => void;
  updateSceneCameraInstant: () => void;

  cameraRig: ReturnType<typeof createCameraRig>;

  cameraSwitcher: () => THREE.PerspectiveCamera;

  cameraRoot: THREE.Group;
}

export function createCameraPackage(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  width: number,
  height: number
): CameraPackage {
  console.log("%c[CameraPackage] init", "color:#4cf;font-weight:bold");

  // ------------------------------------------
  // SceneCamera
  // ------------------------------------------
  const {
    camera: sceneCamera,
    helper: sceneHelper,
    updateSmooth: updateSceneCameraSmooth,
    updateInstant: updateSceneCameraInstant,
  } = createSceneCamera(renderer);

  console.log("[CameraPackage] sceneCamera created:", sceneCamera);

  // IMPORTANT: add camera to scene
  scene.add(sceneCamera);
  console.log(
    "%c[CameraPackage] sceneCamera ADDED TO SCENE",
    "color:#0f0;font-weight:bold"
  );

  scene.add(sceneHelper);
  console.log("[CameraPackage] sceneHelper added");

  // ------------------------------------------
  // Camera Rig
  // ------------------------------------------
  const cameraZ = sceneCamera.position.z;
  const cameraRig = createCameraRig(sceneCamera, cameraZ);

  console.log("[CameraPackage] CameraRig created", { cameraZ });

  useSceneStore.subscribe(() => {
    cameraRig.onResizeOrFovChange();
  });

  // ------------------------------------------
  // OrbitCamera (debug only)
  // ------------------------------------------
  const {
    camera: orbitCamera,
    controls,
    helper: orbitHelper,
  } = createOrbitCamera(renderer, width, height);

  console.log("[CameraPackage] orbitCamera created");

  scene.add(orbitHelper);
  controls.enabled = false;

  // ------------------------------------------
  // Active camera
  // ------------------------------------------
  let activeCamera: THREE.PerspectiveCamera = sceneCamera;
  console.log("[CameraPackage] activeCamera = sceneCamera");

  const cameraSwitcher = () => {
    activeCamera = activeCamera === sceneCamera ? orbitCamera : sceneCamera;
    controls.enabled = activeCamera === orbitCamera;

    console.log(
      "%c[CameraPackage] ⟳ CAMERA SWITCH →",
      "color:#fd0;font-weight:bold",
      activeCamera === sceneCamera ? "SceneCamera" : "OrbitCamera"
    );

    return activeCamera;
  };

  // ------------------------------------------
  // CameraRoot (HUD Parent)
  // ------------------------------------------
  const cameraRoot = new THREE.Group();
  cameraRoot.name = "CameraRoot";
  sceneCamera.add(cameraRoot);

  console.log(
    "%c[CameraPackage] cameraRoot ADDED under sceneCamera",
    "color:#0ff;font-weight:bold",
    cameraRoot
  );

  // DOUBLE VERIFY: log hierarchy
  console.log(
    "[CameraPackage] sceneCamera children:",
    sceneCamera.children.map((c) => c.name || c.type)
  );

  return {
    sceneCamera,
    orbitCamera,
    activeCamera,
    controls,
    updateSceneCameraSmooth,
    updateSceneCameraInstant,
    cameraRig,
    cameraSwitcher,
    cameraRoot,
  };
}
