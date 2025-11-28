import React, { useMemo, useRef } from "react";
import * as THREE from "three";

import { Group } from "../../containers/SceneCore/Layers/Group";
import { ImagePlane } from "../../containers/SceneCore/Geometry/ImagePlane";
import { useFrame } from "@react-three/fiber";

import { useSceneStore } from "../../containers/SceneCore/Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../../containers/SceneCore/Utilities/BreakpointResolver";

import { toggleRegistry } from "./ToggleRegistry";
import { useToggleNode } from "./useToggleNode";

type Vec3 = [number, number, number];

export interface ThreeStateToggleProps {
  /** MUST be unique */
  id: string;

  /** Optional: parent identifier for nested control */
  parentId?: string;

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

export function ThreeStateToggle({
  id,
  parentId,

  name = "ThreeStateToggle",

  troughWidth = { mobile: 200, tablet: 200, desktop: 200 },
  troughHeight = { mobile: 50, tablet: 50, desktop: 50 },
  sliderWidth = { mobile: 75, tablet: 75, desktop: 75 },
  sliderHeight = { mobile: 45, tablet: 45, desktop: 45 },
  radius = { mobile: 5, tablet: 5, desktop: 5 },

  position = { mobile: [0, 0, 20], tablet: [0, 0, 20], desktop: [0, 0, 20] },
  rotation = { mobile: [0, 0, 0], tablet: [0, 0, 0], desktop: [0, 0, 0] },
  scale = { mobile: [1, 1, 1], tablet: [1, 1, 1], desktop: [1, 1, 1] },

  z = 0,

  troughColor = "#afafaf",
  sliderColor = "#d5d5d5",
}: ThreeStateToggleProps) {
  const bp = useSceneStore((s) => s.breakpoint);

  // --------------------------------------------
  // Register this node in the global registry
  // --------------------------------------------
  React.useEffect(() => {
    toggleRegistry.register({
      id,
      label: name,
      parentId,
      state: "off",
    });

    return () => toggleRegistry.unregister(id);
  }, [id, parentId, name]);

  // --------------------------------------------
  // Subscribe to the registry
  // --------------------------------------------
  const { state } = useToggleNode(id);

  // --------------------------------------------
  // Resolve responsive values
  // --------------------------------------------
  const resolvedWidth = resolveResponsive(troughWidth, bp);
  const resolvedHeight = resolveResponsive(troughHeight, bp);
  const resolvedSliderWidth = resolveResponsive(sliderWidth, bp);
  const resolvedSliderHeight = resolveResponsive(sliderHeight, bp);
  const resolvedRadius = resolveResponsive(radius, bp);

  const resolvedPosition = resolveResponsive(position, bp);
  const resolvedRotation = resolveResponsive(rotation, bp);
  const resolvedScale = resolveResponsive(scale, bp);

  // --------------------------------------------
  // Click handler — sends “desired = on/off”
  // Registry computes effective off/cued/on
  // --------------------------------------------
  const handleClick = () => {
    // user-intent toggle:
    const desired = state === "off" ? "on" : "off";
    toggleRegistry.updateState(id, desired);
  };

  // --------------------------------------------
  // Slider target X per registry state
  // --------------------------------------------
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

  // --------------------------------------------
  // Animate slider
  // --------------------------------------------
  useFrame(() => {
    if (!sliderRef.current) return;
    sliderRef.current.position.x = THREE.MathUtils.lerp(
      sliderRef.current.position.x,
      targetX,
      0.15
    );
  });

  // --------------------------------------------
  // Render
  // --------------------------------------------
  return (
    <Group
      name={name}
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
