import * as THREE from "three";
import { createImagePlane } from "./ImagePlane";

export type SceneObjectDefinition = {
  type: "imagePlane";
  src: string;
  width?: number;
  height?: number;
  position?: [number, number, number];
};

interface SceneObjectsOptions {
  scene: THREE.Scene;
  objects: SceneObjectDefinition[];
}

export function applySceneObjects({ scene, objects }: SceneObjectsOptions) {
  const created: THREE.Object3D[] = [];

  for (const obj of objects) {
    let threeObj: THREE.Object3D | null = null;

    switch (obj.type) {
      case "imagePlane":
        threeObj = createImagePlane({
          src: obj.src,
          width: obj.width,
          height: obj.height,
          position: obj.position,
        });
        break;
    }

    if (threeObj) {
      scene.add(threeObj);
      created.push(threeObj);
    }
  }

  return {
    cleanup() {
      for (const o of created) {
        scene.remove(o);
        if ((o as any).geometry) (o as any).geometry.dispose?.();
        if ((o as any).material) (o as any).material.dispose?.();
      }
    },
  };
}
