// src/components/containers/SceneCore/Layers/Group.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext, useParent } from "../Utilities/ParentContext";

import { getBreakpoint } from "../Theme/Breakpoints";
import {
  resolveResponsive,
  BreakpointKey,
} from "../Utilities/ResponsiveResolve";

// ----------------------------------------
// RESPONSIVE TYPES
// ----------------------------------------
interface ResponsiveVec3 {
  mobile?: [number, number, number];
  tablet?: [number, number, number];
  desktop?: [number, number, number];
}

// ----------------------------------------
// PUBLIC PROPS
// ----------------------------------------
export interface GroupProps {
  children?: React.ReactNode;

  /** Fully responsive transforms */
  position?: [number, number, number] | ResponsiveVec3;
  rotation?: [number, number, number] | ResponsiveVec3;
  scale?: [number, number, number] | ResponsiveVec3;

  /** Single z offset (not responsive) */
  z?: number;

  /** Single visibility flag (not responsive) */
  visible?: boolean;
}

// ----------------------------------------

export function Group({
  children,

  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  z = 0,
  visible = true,
}: GroupProps) {
  const stage = useStage();
  const parent = useParent();
  const groupRef = useRef(new THREE.Group());

  // ----------------------------------------
  // Helper — resolve only responsive transforms
  // ----------------------------------------
  const resolveTransforms = () => {
    const bp = getBreakpoint(window.innerWidth) as BreakpointKey;

    const pos = resolveResponsive<[number, number, number]>(
      position,
      bp,
      [0, 0, 0]
    );

    const rot = resolveResponsive<[number, number, number]>(
      rotation,
      bp,
      [0, 0, 0]
    );

    const scl = resolveResponsive<[number, number, number]>(
      scale,
      bp,
      [1, 1, 1]
    );

    return { pos, rot, scl };
  };

  // ----------------------------------------
  // Initial mount
  // ----------------------------------------
  useEffect(() => {
    const g = groupRef.current;
    const { pos, rot, scl } = resolveTransforms();

    g.position.set(pos[0], pos[1], pos[2] + z);
    g.rotation.set(rot[0], rot[1], rot[2]);
    g.scale.set(scl[0], scl[1], scl[2]);
    g.visible = visible;

    stage.addObject(g, parent);

    return () => stage.removeObject(g);
  }, []);

  // ----------------------------------------
  // Update on prop changes
  // ----------------------------------------
  useEffect(() => {
    const g = groupRef.current;
    const { pos, rot, scl } = resolveTransforms();

    g.position.set(pos[0], pos[1], pos[2] + z);
    g.rotation.set(rot[0], rot[1], rot[2]);
    g.scale.set(scl[0], scl[1], scl[2]);
    g.visible = visible;
  }, [position, rotation, scale, z, visible]);

  // ----------------------------------------
  // Update on resize or FOV change
  // ----------------------------------------
  useEffect(() => {
    if (!stage.onResizeOrFovChange) return;

    const unsub = stage.onResizeOrFovChange(() => {
      const g = groupRef.current;
      const { pos, rot, scl } = resolveTransforms();

      g.position.set(pos[0], pos[1], pos[2] + z);
      g.rotation.set(rot[0], rot[1], rot[2]);
      g.scale.set(scl[0], scl[1], scl[2]);
      g.visible = visible;
    });

    return () => unsub?.();
  }, [stage, position, rotation, scale, z, visible]);

  return (
    <ParentContext.Provider value={groupRef.current}>
      {children}
    </ParentContext.Provider>
  );
}
