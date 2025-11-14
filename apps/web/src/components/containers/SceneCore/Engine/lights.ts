// SceneCore/engine/lights.ts
import * as THREE from "three";
import { CameraHelper } from "three";

export function createLights(scene: THREE.Scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(4, 6, 3);
  dir.intensity = 1.2;
  dir.castShadow = true;
  dir.castShadow = true;

  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  dir.shadow.normalBias = 0.02;
  dir.shadow.bias = -0.0005;

  scene.add(dir);

  const helper = new CameraHelper(dir.shadow.camera);
scene.add(helper);
}
