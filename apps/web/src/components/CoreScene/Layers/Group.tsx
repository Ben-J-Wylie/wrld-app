// Group.tsx
import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";

import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver";

type Vec3 = [number, number, number];

// Convert degrees → radians
function degVec3(v: Vec3): Vec3 {
  return [
    THREE.MathUtils.degToRad(v[0]),
    THREE.MathUtils.degToRad(v[1]),
    THREE.MathUtils.degToRad(v[2]),
  ];
}

export interface GroupProps {
  name?: string;
  position?: ResponsiveValue<Vec3>; // degrees
  rotation?: ResponsiveValue<Vec3>; // degrees
  scale?: ResponsiveValue<Vec3>;

  anchor?: Vec3; // normalized 0..1
  visible?: boolean;
  children?: React.ReactNode;
}

/**
 * WrldGroup:
 * A transform group with its own anchor offset.
 * - Fully responsive (same interface as ImagePlane)
 * - Nestable (groups inside groups)
 * - Local anchor point for pivot-based transforms
 */
export const Group = forwardRef<THREE.Group, GroupProps>(
  (
    {
      name,
      position = [0, 0, 0],
      rotation = [0, 0, 0], // degrees
      scale = [1, 1, 1],
      anchor = [0, 0, 0], // default = center, but used when bounding box is known
      visible = true,
      children,
    },
    ref
  ) => {
    const bp = useSceneStore((s) => s.breakpoint);

    // --------------------------------------------------
    // Resolve responsive transforms
    // --------------------------------------------------
    const resolvedPos = resolveResponsive(position, bp) as Vec3;
    const resolvedRotDeg = resolveResponsive(rotation, bp) as Vec3;
    const resolvedRot = degVec3(resolvedRotDeg);
    const resolvedScale = resolveResponsive(scale, bp) as Vec3;

    // --------------------------------------------------
    // ANCHOR OFFSET
    // --------------------------------------------------
    // Right now we assume the anchor is *local-centric offset*.
    // This works perfectly for grouping ImagePlanes, Sprites, Toggles, etc.
    //
    // The math:
    // - group pivot is at "anchor"
    // - we shift children such that the pivot acts like true center
    //
    // Later we can compute bounding boxes dynamically
    // to support anchor={[0.5,0.5,0]} meaning "true center of children".
    // For now anchor is a direct offset.
    // --------------------------------------------------

    const anchorOffset = useMemo(() => {
      return new THREE.Vector3(anchor[0], anchor[1], anchor[2]);
    }, [anchor]);

    // --------------------------------------------------
    // Render
    // --------------------------------------------------
    return (
      <group
        ref={ref}
        name={name}
        position={resolvedPos}
        rotation={resolvedRot}
        scale={resolvedScale}
        visible={visible}
      >
        {/* Inner group applies anchor shift */}
        {/* So the *outer* group transforms around that pivot point */}
        <group position={anchorOffset.multiplyScalar(-1)}>{children}</group>
      </group>
    );
  }
);

Group.displayName = "Group";
