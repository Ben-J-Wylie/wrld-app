// SceneCore/Layers/TextPlane.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createTextPlane } from "./TextPlanePrimitive";
import { useStage } from "@/components/containers/SceneCore/Stage/useStage";
import { getBreakpoint } from "@/components/containers/SceneCore/Layers/Breakpoints";

// --------- Responsive Types ---------

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

// --------- Public API ---------

export interface TextPlaneProps {
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  background?: string | null;
  padding?: number;

  width?: ResponsiveNumber; // world units (auto if omitted)
  height?: ResponsiveNumber; // world units (auto if omitted)

  position?: ResponsiveVec3;
  rotation?: ResponsiveVec3;

  z?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
  onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;

  __parent?: THREE.Object3D | null;
}

// --------- Breakpoint Hook ---------

function useBreakpoint() {
  const [bp, setBp] = useState(getBreakpoint(window.innerWidth));

  useEffect(() => {
    const onResize = () => setBp(getBreakpoint(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}

// --------- Component ---------

export function TextPlane({
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
  __parent = null,

  castShadow,
  receiveShadow,

  onClick,
  onHover,
}: TextPlaneProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const stage = useStage();
  const bp = useBreakpoint();

  // Resolve responsive props
  const w = width?.[bp];
  const h = height?.[bp];

  const pos = position?.[bp] ?? [0, 0, 0];
  const rot = rotation?.[bp] ?? [0, 0, 0];

  // ------- MOUNT -------
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

    // Initial transforms
    if (w && h) mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);

    stage.addObject(mesh, __parent);

    if (onClick || onHover) {
      stage.registerInteractive(mesh, { onClick, onHover });
    }

    return () => {
      if (onClick || onHover) stage.unregisterInteractive(mesh);

      stage.removeObject(mesh);
      mesh.geometry?.dispose?.();
      (mesh.material as THREE.Material)?.dispose?.();
    };
  }, []);

  // ------- RESPONSIVE UPDATES -------
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Only apply width/height if provided
    if (w && h) mesh.scale.set(w, h, 1);

    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
  }, [bp, w, h, pos, rot, z]);

  return null;
}
