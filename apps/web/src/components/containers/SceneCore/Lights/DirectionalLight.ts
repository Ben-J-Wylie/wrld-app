// src/DirectionalLight.ts
import * as THREE from "three";

export function createDirectionalLight() {
  const group = new THREE.Group();

  // --- Directional Light ----------------------------------------------------
  const light = new THREE.DirectionalLight(0xffffff, 1.2);
  light.position.set(-100, 50, 1000);
  light.castShadow = true;

  // Required target (DirectionalLights must aim at something)
  const target = new THREE.Object3D();
  target.position.set(0, 0, 0);
  light.target = target;

  group.add(light);
  group.add(target);

  // --- Shadow Settings ------------------------------------------------------
  light.shadow.mapSize.set(2048, 2048);

  // VSM blur controls
  light.shadow.radius = 8;
  light.shadow.blurSamples = 16;

  // bias tuning
  light.shadow.bias = -0.0001;
  light.shadow.normalBias = 0.01;

  // --- Shadow Camera (Orthographic) ----------------------------------------
  const cam = light.shadow.camera as THREE.OrthographicCamera;

  cam.near = 0.5;
  cam.far = 1500;

  cam.left = -1000;
  cam.right = 1000;
  cam.top = 1000;
  cam.bottom = -1000;

  cam.updateProjectionMatrix();

  // --- Helper ---------------------------------------------------------------
  const helper = new THREE.CameraHelper(light.shadow.camera);
  group.add(helper);

  return group;
}
