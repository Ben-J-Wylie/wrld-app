import React, { useState, useMemo, useRef } from "react";
import * as THREE from "three";

import { Group } from "../../containers/SceneCore/Layers/Group";
import { ImagePlane } from "../../containers/SceneCore/Geometry/ImagePlane";
import { useFrame } from "@react-three/fiber";

import { useSceneStore } from "../../containers/SceneCore/Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../../containers/SceneCore/Utilities/BreakpointResolver";

type Vec3 = [number, number, number];

export interface ThreeStateToggleProps {
  // ---- Responsive trough & slider sizing ----
  troughWidth?: ResponsiveValue<number>;
  troughHeight?: ResponsiveValue<number>;
  sliderWidth?: ResponsiveValue<number>;
  sliderHeight?: ResponsiveValue<number>;

  // ---- Corner rounding ----
  radius?: ResponsiveValue<number>;

  // ---- Placement ----
  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  // ---- Render order ----
  z?: number;

  // ---- Colors (if no texture) ----
  troughColor?: string;
  sliderColor?: string;

  // ---- Emit changes ----
  onChange?: (state: "off" | "cued" | "on") => void;
}

export function ThreeStateToggle({
  // DEFAULTS (can be overridden by consumer)
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

  onChange,
}: ThreeStateToggleProps) {
  const bp = useSceneStore((s) => s.breakpoint);

  const [state, setState] = useState<"off" | "cued" | "on">("off");

  const resolvedWidth = resolveResponsive(troughWidth, bp);
  const resolvedHeight = resolveResponsive(troughHeight, bp);

  const resolvedSliderWidth = resolveResponsive(sliderWidth, bp);
  const resolvedSliderHeight = resolveResponsive(sliderHeight, bp);

  const resolvedRadius = resolveResponsive(radius, bp);

  const resolvedPosition = resolveResponsive(position, bp);
  const resolvedRotation = resolveResponsive(rotation, bp);
  const resolvedScale = resolveResponsive(scale, bp);

  // -------------------------------------------------------
  // Cycle states when slider is clicked
  // -------------------------------------------------------
  function nextState() {
    setState((prev) => {
      const next = prev === "off" ? "cued" : prev === "cued" ? "on" : "off";

      onChange?.(next);
      return next;
    });
  }

  // -------------------------------------------------------
  // Slider TARGET X positions per state
  // Automatically scales with trough width
  // -------------------------------------------------------
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

  // -------------------------------------------------------
  // Smooth animation using useFrame
  // -------------------------------------------------------
  useFrame(() => {
    if (!sliderRef.current) return;

    sliderRef.current.position.x = THREE.MathUtils.lerp(
      sliderRef.current.position.x,
      targetX,
      0.15 // animation speed
    );
  });

  // -------------------------------------------------------
  // Render
  // -------------------------------------------------------
  return (
    <Group
      name="ThreeStateToggle"
      position={resolvedPosition}
      rotation={resolvedRotation}
      scale={resolvedScale}
      anchor={[0.5, 0.5, 0]}
    >
      {/* Trough */}
      <ImagePlane
        name="Toggle Trough"
        width={resolvedWidth}
        height={resolvedHeight}
        cornerRadius={resolvedRadius}
        position={[0, 0, z]}
        color={troughColor}
        castShadow={true}
        receiveShadow={true}
      />

      {/* Slider */}
      <ImagePlane
        ref={sliderRef}
        name="Toggle Slider"
        width={resolvedSliderWidth}
        height={resolvedSliderHeight}
        cornerRadius={resolvedRadius}
        position={[targetX, 0, z + 10]} // initial position
        color={sliderColor}
        castShadow={true}
        receiveShadow={true}
        onClick={() => nextState()}
      />
    </Group>
  );
}
