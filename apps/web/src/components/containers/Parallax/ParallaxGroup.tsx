// In simple terms:
// - A 3D “container” for anything that should sit at a certain depth from the camera.

// Controls:
// - depth: how far away it is (smaller = closer, moves faster; larger = farther).
// - baseY: initial vertical offset.

// Impact:
// - Controls how each layer participates in the 3D depth illusion.

// src/parallax/ParallaxGroup.tsx
import { ThreeElements } from "@react-three/fiber";
import { ParallaxConfig } from "./ParallaxConfig";

type GroupProps = ThreeElements["group"];

interface ParallaxGroupProps extends GroupProps {
  /** Distance from camera: smaller = closer (moves faster), larger = farther (moves slower) */
  depth?: number;
  /** Optional Y offset */
  baseY?: number;
}

/**
 * ParallaxGroup
 * ------------------------------------------------------------
 * Holds one or more parallax-aware objects at a given depth.
 * Depth and baseY now read from ParallaxConfig.scene.layerDefaults
 * to reflect world-space geometry.
 */
export function ParallaxGroup({
  depth = 0,
  baseY = ParallaxConfig.scene.layerDefaults.baseY,
  ...props
}: ParallaxGroupProps) {
  return <group position={[0, baseY, depth]} {...props} />;
}
