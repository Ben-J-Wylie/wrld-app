// NestedToggle.tsx
import React, { useMemo, useRef } from "react";
import * as THREE from "three";

import { Group } from "../../CoreScene/Layers/Group";
import { ImagePlane } from "../../CoreScene/Geometry/ImagePlane";
import { useFrame } from "@react-three/fiber";

import { useSceneStore } from "../../CoreScene/Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../../CoreScene/Utilities/BreakpointResolver";

import { toggleRegistry } from "./ToggleRegistry";
import { ToggleNode as useToggleNode } from "./ToggleNode";
import { ToggleTree } from "./ToggleTree"; // needed for overrides

type Vec3 = [number, number, number];

export interface NestedToggleProps {
  id: string;

  /** You may still override this visually. */
  name?: string;

  troughWidth?: ResponsiveValue<number>;
  troughHeight?: ResponsiveValue<number>;
  sliderWidth?: ResponsiveValue<number>;
  sliderHeight?: ResponsiveValue<number>;
  radius?: ResponsiveValue<number>;

  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  z?: number;

  troughColor?: string;
  sliderColor?: string;
}

export function NestedToggle({
  id,
  name,

  troughWidth = { mobile: 200, tablet: 200, desktop: 200 },
  troughHeight = { mobile: 50, tablet: 50, desktop: 50 },
  sliderWidth = { mobile: 75, tablet: 75, desktop: 75 },
  sliderHeight = { mobile: 45, tablet: 45, desktop: 45 },
  radius = { mobile: 5, tablet: 5, desktop: 5 },

  position = { mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] },
  rotation = { mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] },
  scale = { mobile: [1, 1, 1], tablet: [1, 1, 1], desktop: [1, 1, 1] },

  z = 0,

  troughColor = "#afafaf",
  sliderColor = "#d5d5d5",
}: NestedToggleProps) {
  const bp = useSceneStore((s) => s.breakpoint);

  // -----------------------------------------------------------
  // Correct registration logic:
  // 1. If tree loaded it already registered → do NOT override.
  // 2. Only override label if "name" is provided.
  // -----------------------------------------------------------
  React.useEffect(() => {
    const existing = toggleRegistry.getNode(id);

    if (existing) {
      // Only override label if provided, keep the existing state + parent
      if (name && existing.label !== name) {
        toggleRegistry.register({
          id,
          label: name,
          state: existing.state,
          parentId: existing.parentId,
        });
      }
      return;
    }

    // If not in registry yet → register using tree defaults
    const treeDef = ToggleTree[id];

    toggleRegistry.register({
      id,
      label: name ?? treeDef.label,
      parentId: treeDef.parentId,
      state: treeDef.state,
    });

    return () => toggleRegistry.unregister(id);
  }, [id, name]);

  // -----------------------------------------------------------
  // Subscribe to registry
  // -----------------------------------------------------------
  const { state } = useToggleNode(id);

  // -----------------------------------------------------------
  // Resolve responsive
  // -----------------------------------------------------------
  const resolvedWidth = resolveResponsive(troughWidth, bp);
  const resolvedHeight = resolveResponsive(troughHeight, bp);
  const resolvedSliderWidth = resolveResponsive(sliderWidth, bp);
  const resolvedSliderHeight = resolveResponsive(sliderHeight, bp);
  const resolvedRadius = resolveResponsive(radius, bp);

  const resolvedPosition = resolveResponsive(position, bp);
  const resolvedRotation = resolveResponsive(rotation, bp);
  const resolvedScale = resolveResponsive(scale, bp);

  // -----------------------------------------------------------
  // Handle click
  // -----------------------------------------------------------
  const handleClick = () => {
    const desired = state === "off" ? "on" : "off";
    toggleRegistry.updateState(id, desired);
  };

  // -----------------------------------------------------------
  // Slider animation
  // -----------------------------------------------------------
  const targetX = useMemo(() => {
    switch (state) {
      case "off":
        return -0.25 * resolvedWidth;
      case "cued":
        return 0;
      case "on":
        return +0.25 * resolvedWidth;
    }
  }, [state, resolvedWidth]);

  const sliderRef = useRef<THREE.Mesh>(null!);

  useFrame(() => {
    if (!sliderRef.current) return;
    sliderRef.current.position.x = THREE.MathUtils.lerp(
      sliderRef.current.position.x,
      targetX,
      0.15
    );
  });

  // -----------------------------------------------------------
  // Render
  // -----------------------------------------------------------
  return (
    <Group
      name={name ?? id}
      position={resolvedPosition}
      rotation={resolvedRotation}
      scale={resolvedScale}
      anchor={[0.5, 0.5, 0]}
    >
      {/* Trough */}
      <ImagePlane
        name={`${id}-Trough`}
        width={resolvedWidth}
        height={resolvedHeight}
        cornerRadius={resolvedRadius}
        position={[0, 0, z]}
        color={troughColor}
        castShadow
        receiveShadow
      />

      {/* Slider */}
      <ImagePlane
        ref={sliderRef}
        name={`${id}-Slider`}
        width={resolvedSliderWidth}
        height={resolvedSliderHeight}
        cornerRadius={resolvedRadius}
        position={[targetX, 0, z + 10]}
        color={sliderColor}
        castShadow
        receiveShadow
        onPointerDown={handleClick}
      />
    </Group>
  );
}
