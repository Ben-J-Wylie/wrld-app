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
}

export function createCameraPackage(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  width: number,
  height: number
): CameraPackage {
  // ------------------------------------------
  // SceneCamera
  // ------------------------------------------
  const {
    camera: sceneCamera,
    helper: sceneHelper,
    updateSmooth: updateSceneCameraSmooth,
    updateInstant: updateSceneCameraInstant,
  } = createSceneCamera(renderer);

  scene.add(sceneHelper);

  // ------------------------------------------
  // Camera Rig
  // ------------------------------------------
  const cameraZ = sceneCamera.position.z;
  const cameraRig = createCameraRig(sceneCamera, cameraZ);

  useSceneStore.subscribe(() => {
    cameraRig.onResizeOrFovChange();
  });

  // ------------------------------------------
  // OrbitCamera
  // ------------------------------------------
  const {
    camera: orbitCamera,
    controls,
    helper: orbitHelper,
  } = createOrbitCamera(renderer, width, height);

  scene.add(orbitHelper);
  controls.enabled = false;

  // ------------------------------------------
  // Active camera
  // ------------------------------------------
  let activeCamera: THREE.PerspectiveCamera = sceneCamera;

  // ------------------------------------------
  // Camera Switcher
  // ------------------------------------------
  const cameraSwitcher = () => {
    activeCamera = activeCamera === sceneCamera ? orbitCamera : sceneCamera;

    controls.enabled = activeCamera === orbitCamera;

    return activeCamera;
  };

  return {
    sceneCamera,
    orbitCamera,
    activeCamera,
    controls,
    updateSceneCameraSmooth,
    updateSceneCameraInstant,
    cameraRig,
    cameraSwitcher,
  };
}
