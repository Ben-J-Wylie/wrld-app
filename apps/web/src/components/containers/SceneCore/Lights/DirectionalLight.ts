// src/DirectionalLight.ts
import * as THREE from "three";

export function createDirectionalLight() {
  const group = new THREE.Group();

  // --- Directional Light ----------------------------------------------------
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(3, 3, 15);
  light.castShadow = true;

  // Required target (DirectionalLights must aim at something)
  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  light.target = target;

  group.add(light);
  group.add(target);

  // --- Shadow Settings ------------------------------------------------------
  light.shadow.mapSize.set(512, 512);

  // VSM blur controls
  light.shadow.radius = 12;
  light.shadow.blurSamples = 16;

  // bias tuning
  light.shadow.bias = -0.0001;
  light.shadow.normalBias = 0.05;

  // --- Shadow Camera (Orthographic) ----------------------------------------
  const cam = light.shadow.camera as THREE.OrthographicCamera;

  cam.near = 0.5;
  cam.far = 50;

  cam.left = -10;
  cam.right = 10;
  cam.top = 10;
  cam.bottom = -10;

  cam.updateProjectionMatrix();

  // --- Helper ---------------------------------------------------------------
  const helper = new THREE.CameraHelper(light.shadow.camera);
  group.add(helper);

  return group;
}
