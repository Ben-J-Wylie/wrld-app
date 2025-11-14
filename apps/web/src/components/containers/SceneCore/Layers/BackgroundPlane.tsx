// SceneCore/engine/objects/BackgroundPlane.ts
import * as THREE from "three";
import { SceneConfig } from "../SceneConfig";
import { useSceneStore } from "../SceneStore";

export interface BackgroundPlaneOptions {
  src?: string;
  color?: string;
  width?: number;
  height?: number;
  depth?: number; // z position
}

/**
 * Vanilla Three.js version of BackgroundPlane.
 * - Reads sceneWidth/sceneHeight once from the SceneStore
 * - Falls back to SceneConfig if store is unset
 * - Allows direct overrides via options.width / options.height
 * - Uses Phong material with optional texture map
 */
export function createBackgroundPlane(options: BackgroundPlaneOptions = {}) {
  const {
    src,
    color,
    width,
    height,
    depth = SceneConfig.scene.background.depth,
  } = options;

  // ----- read current store snapshot -----
  const { sceneWidth, sceneHeight } = useSceneStore.getState();

  // width priority: props → store → config
  const planeWidth =
    width ?? sceneWidth ?? SceneConfig.scene.background.sceneWidth;

  // height priority: props → store → config → square fallback
  const planeHeight =
    height ??
    sceneHeight ??
    SceneConfig.scene.background.sceneHeight ??
    planeWidth;

  const finalColor = color ?? SceneConfig.scene.background.color ?? "#dddddd";

  // ----- geometry -----
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

  // base Phong material (color only for now)
  const material = new THREE.MeshPhongMaterial({
    color: finalColor,
    shininess: 100,
    specular: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(0, 0, depth);
  mesh.receiveShadow = true;

  // ----- optional texture loading -----
  if (src) {
    const loader = new THREE.TextureLoader();
    loader.load(
      src,
      (texture) => {
        material.map = texture;
        material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn("Background texture failed to load:", err);
      }
    );
  }

  return mesh;
}
