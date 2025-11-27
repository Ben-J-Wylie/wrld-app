// src/components/containers/SceneCore/Geometry/RoundedRectangle.ts
import * as THREE from "three";

/**
 * Creates a rounded rectangle Shape geometry.
 */
export function createRoundedRectangleShape(
  width: number,
  height: number,
  radius: number
) {
  const w = width;
  const h = height;
  const r = Math.min(radius, Math.min(w, h) / 2);

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  return shape;
}
