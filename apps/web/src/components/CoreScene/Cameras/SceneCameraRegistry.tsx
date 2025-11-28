// src/components/containers/SceneCore/Cameras/SceneCameraRegistry.ts
import * as THREE from "three";

let sceneCamera: THREE.PerspectiveCamera | null = null;
let sceneCameraZ: number = 1000; // default fallback so rig never breaks

export function registerSceneCamera(cam: THREE.PerspectiveCamera, z?: number) {
  sceneCamera = cam;

  if (typeof z === "number") {
    sceneCameraZ = z;
  }
}

export function getSceneCamera() {
  return sceneCamera;
}

export function getSceneCameraZ() {
  return sceneCameraZ;
}
