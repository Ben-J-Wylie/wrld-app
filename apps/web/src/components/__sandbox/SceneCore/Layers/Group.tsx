// @ts-nocheck

import { ThreeElements } from "@react-three/fiber";
import { SceneConfig } from "../SceneConfig";
import { ReactNode } from "react";

type GroupProps = ThreeElements["group"];

interface GroupLayerProps extends GroupProps {
  /** Distance from camera: smaller = closer (moves faster), larger = farther (moves slower) */
  depth?: number;
  /** Optional Y offset */
  baseY?: number;
  /** Child elements to render inside the group */
  children?: ReactNode;
}

/**
 * Group
 * ---------------------------------------------------------------------------
 * 3D container for scene elements at a specific world-space depth.
 * Provides spatial grouping for consistent depth management.
 */
export function Group({
  depth = 0,
  baseY = SceneConfig.scene.background.depth ?? 0,
  children,
  ...props
}: GroupLayerProps) {
  return (
    <group position={[0, baseY, depth]} {...props}>
      {children}
    </group>
  );
}
