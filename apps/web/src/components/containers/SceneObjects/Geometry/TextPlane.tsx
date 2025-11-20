// src/components/containers/SceneCore/Layers/TextPlane.tsx
import { useEffect, useRef } from "react";
import * as THREE from "three";

import { createTextPlane } from "./TextPlanePrimitive";
import { useStage } from "../../SceneCore/Stage/useStage";
import { useParent } from "../../SceneCore/Utilities/ParentContext";
import { getBreakpoint } from "../../SceneCore/Theme/Breakpoints";
import { resolveResponsive } from "../../SceneCore/Utilities/ResponsiveResolve";
import type { BreakpointKey } from "../../SceneCore/Utilities/ResponsiveResolve";

interface ResponsiveNumber {
  mobile?: number;
  tablet?: number;
  desktop?: number;
}

interface ResponsiveVec3 {
  mobile?: [number, number, number];
  tablet?: [number, number, number];
  desktop?: [number, number, number];
}

export interface TextPlaneProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  background?: string | null;
  padding?: number;

  width?: number | ResponsiveNumber;
  height?: number | ResponsiveNumber;

  position?: [number, number, number] | ResponsiveVec3;
  rotation?: [number, number, number] | ResponsiveVec3;

  z?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
  onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
}

export function TextPlane(props: TextPlaneProps) {
  const {
    text,
    fontSize,
    fontFamily,
    color,
    background,
    padding,

    width,
    height,
    position,
    rotation,
    z = 0,

    castShadow,
    receiveShadow,

    onClick,
    onHover,
  } = props;

  const stage = useStage();
  const parent = useParent() ?? null;
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Breakpoint detection
  const bp = getBreakpoint(window.innerWidth) as BreakpointKey;

  // Responsive resolution (identical to ImagePlane)
  const w = resolveResponsive(width, bp, 100);
  const h = resolveResponsive(height, bp, 100);
  const pos = resolveResponsive(position, bp, [0, 0, 0]);
  const rot = resolveResponsive(rotation, bp, [0, 0, 0]);

  // -------------------------------------------------------
  // CREATE + MOUNT (only once)
  // -------------------------------------------------------
  useEffect(() => {
    const mesh = createTextPlane({
      text,
      fontSize,
      fontFamily,
      color,
      background,
      padding,
      castShadow,
      receiveShadow,
    });

    meshRef.current = mesh;

    mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);

    stage.addObject(mesh, parent);

    if (onClick || onHover) {
      stage.registerInteractive(mesh, { onClick, onHover });
    }

    return () => {
      const m = meshRef.current;
      if (!m) return;

      if (onClick || onHover) stage.unregisterInteractive(m);
      stage.removeObject(m);

      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    };
  }, [
    text,
    fontSize,
    fontFamily,
    color,
    background,
    padding,
    castShadow,
    receiveShadow,
    stage,
    parent,
    onClick,
    onHover,
  ]);

  // -------------------------------------------------------
  // UPDATE transforms on breakpoint or responsive change
  // -------------------------------------------------------
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
  });

  return null;
}
