import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

import { createSceneCamera } from "./SceneCamera";
import { createCameraRig } from "./CameraRig";
import { createOrbitCamera } from "./OrbitCamera";
import { useSceneStore } from "../Store/SceneStore";

export interface CameraPackage {
  sceneCamera: THREE.PerspectiveCamera;
  orbitCamera: THREE.PerspectiveCamera;

  activeCameraRef: { current: THREE.PerspectiveCamera };

  controls: OrbitControls;

  updateSceneCameraSmooth: () => void;
  updateSceneCameraInstant: () => void;

  cameraRig: any;

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
  // Reactive Active Camera Reference
  // ------------------------------------------
  const activeCameraRef = { current: sceneCamera };

  // ------------------------------------------
  // Camera Switcher
  // ------------------------------------------
  const cameraSwitcher = () => {
    activeCameraRef.current =
      activeCameraRef.current === sceneCamera ? orbitCamera : sceneCamera;

    controls.enabled = activeCameraRef.current === orbitCamera;

    return activeCameraRef.current;
  };

  return {
    sceneCamera,
    orbitCamera,
    activeCameraRef,
    controls,
    updateSceneCameraSmooth,
    updateSceneCameraInstant,
    cameraRig,
    cameraSwitcher,
  };
}
