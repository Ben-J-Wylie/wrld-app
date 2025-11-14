// SceneCore/engine/objects/Group.ts
import * as THREE from "three";

export interface GroupOptions {
  x?: number;
  y?: number;
  depth?: number; // z-position
}

export function createGroup(options: GroupOptions = {}) {
  const { x = 0, y = 0, depth = 0 } = options;

  const group = new THREE.Group();
  group.position.set(x, y, depth);

  return group;
}
