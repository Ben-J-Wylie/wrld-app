// src/components/containers/SceneCore/Layers/TextPlane.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createTextPlane } from "./TextPlanePrimitive";
import { useStage } from "../../SceneCore/Stage/useStage";
import { useParent } from "../../SceneCore/Layers/ParentContext";
import { getBreakpoint } from "../../SceneCore/Theme/Breakpoints";

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

  width?: ResponsiveNumber;
  height?: ResponsiveNumber;

  position?: ResponsiveVec3;
  rotation?: ResponsiveVec3;

  z?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
  onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
}

// -----------------------------------------------------
// Breakpoint Hook
// -----------------------------------------------------
function useBreakpoint() {
  const [bp, setBp] = useState(getBreakpoint(window.innerWidth));

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}

// -----------------------------------------------------
// TEXT PLANE COMPONENT
// -----------------------------------------------------
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

  const meshRef = useRef<THREE.Mesh | null>(null);
  const stage = useStage();
  const parent = useParent() ?? null;

  const bp = useBreakpoint();

  const w = width?.[bp] ?? 1;
  const h = height?.[bp] ?? 1;

  const pos = position?.[bp] ?? [0, 0, 0];
  const rot = rotation?.[bp] ?? [0, 0, 0];

  // -----------------------------------------------------
  // CREATE + MOUNT MESH
  // -----------------------------------------------------
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
    parent, // <-- ensures correct parenting updates
  ]);

  // -----------------------------------------------------
  // UPDATE TRANSFORMS ON BREAKPOINT/RESPONSIVE CHANGE
  // -----------------------------------------------------
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
  }, [bp, w, h, pos, rot, z]);

  return null;
}
