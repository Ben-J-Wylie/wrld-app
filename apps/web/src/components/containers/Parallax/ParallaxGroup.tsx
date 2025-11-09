// src/parallax/ParallaxGroup.tsx
import { ThreeElements } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";

type GroupProps = ThreeElements["group"];

interface ParallaxGroupProps extends GroupProps {
  /** Distance from camera: smaller = closer (moves faster), larger = farther (moves slower) */
  depth?: number;
  /** Optional Y offset */
  baseY?: number;
}

export function ParallaxGroup({
  depth = 0,
  baseY = 0,
  ...props
}: ParallaxGroupProps) {
  const ref = useRef<THREE.Group>(null!);

  // In perspective mode, just place the object in world space
  return <group ref={ref} position={[0, baseY, depth]} {...props} />;
}
