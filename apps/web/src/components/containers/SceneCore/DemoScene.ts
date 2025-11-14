// SceneCore/DemoScene.ts
import * as THREE from "three";
import { Layers } from "./index"; // gives us createGroup, createImagePlane, createBackgroundPlane
import { useSceneStore, SceneConfig } from "./index";

export function createDemoScene() {
  const root = new THREE.Group();

  // --------------------------------------------
  // 1. Set world height (same logic as R3F DemoScene)
  // --------------------------------------------
  const setSceneHeight = useSceneStore.getState().setSceneHeight;
  setSceneHeight(3.2); // identical to your R3F version

  // --------------------------------------------
  // 2. Background plane
  // --------------------------------------------
  const bg = Layers.createBackgroundPlane({
    depth: 0,
    color: "#cc1010ff",
  });
  root.add(bg);

  // --------------------------------------------
  // 3. Mid layer (slightly forward)
  // --------------------------------------------
  const mid2 = Layers.createGroup({ depth: 0.1 });
  const mid2Image = Layers.createImagePlane({
    src: "./mid2.png",
    width: 8,
  });
  mid2.add(mid2Image);
  root.add(mid2);

  // --------------------------------------------
  // 4. Another mid layer further forward
  // --------------------------------------------
  const mid1 = Layers.createGroup({ depth: 2 });
  const mid1Image = Layers.createImagePlane({
    src: "./mid1.png",
    width: 6,
  });
  mid1.add(mid1Image);
  root.add(mid1);

  // --------------------------------------------
  // 5. Front layer
  // --------------------------------------------
  const front = Layers.createGroup({ depth: 3 });
  const frontImage = Layers.createImagePlane({
    src: "./front.png",
    width: 4,
  });
  front.add(frontImage);
  root.add(front);

  return root;
}
