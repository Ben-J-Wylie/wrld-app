// src/components/containers/SceneCore/Layers/ScreenGroup.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext } from "../Utilities/ParentContext";

import { getBreakpoint } from "../Theme/Breakpoints";
import {
  resolveResponsive,
  BreakpointKey,
} from "../Utilities/ResponsiveResolve";

// -----------------------------------
// TYPES
// -----------------------------------
type AnchorX = "left" | "center" | "right";
type AnchorY = "top" | "center" | "bottom";

interface ResponsiveVec3 {
  mobile?: [number, number, number];
  tablet?: [number, number, number];
  desktop?: [number, number, number];
}

export interface ScreenGroupProps {
  children?: React.ReactNode;

  anchorX?: AnchorX;
  anchorY?: AnchorY;

  offsetX?: number;
  offsetY?: number;

  /** Positive z = farther from camera */
  z?: number;

  /** Local transforms — fully responsive */
  position?: [number, number, number] | ResponsiveVec3;
  rotation?: [number, number, number] | ResponsiveVec3;
  scale?: [number, number, number];
}

// -----------------------------------

export function ScreenGroup({
  children,

  anchorX = "center",
  anchorY = "center",
  offsetX = 0,
  offsetY = 0,
  z = 20,

  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: ScreenGroupProps) {
  const stage = useStage();
  const cameraRoot = stage.getCameraRoot();
  const getCamera = stage.getCamera;

  const groupRef = useRef<THREE.Group | null>(null);
  const [mountedGroup, setMountedGroup] = useState<THREE.Group | null>(null);

  // Create & attach to cameraRoot
  useEffect(() => {
    const g = new THREE.Group();
    groupRef.current = g;
    cameraRoot.add(g);
    setMountedGroup(g);

    return () => {
      cameraRoot.remove(g);
    };
  }, []);

  // ----------------------------------------
  // UPDATE ANCHOR LOGIC
  // ----------------------------------------
  const updateAnchor = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;

    const camera = getCamera();
    if (!camera) return;

    // Resolve responsive values
    const bp = getBreakpoint(window.innerWidth) as BreakpointKey;

    const resolvedPos = resolveResponsive<[number, number, number]>(
      position,
      bp,
      [0, 0, 0]
    );

    const resolvedRot = resolveResponsive<[number, number, number]>(
      rotation,
      bp,
      [0, 0, 0]
    );

    // ----- frustum size at depth -----
    const halfH = z * Math.tan((camera.fov * Math.PI) / 360);
    const halfW = halfH * camera.aspect;

    let anchorXPos = 0;
    let anchorYPos = 0;

    if (anchorX === "left") anchorXPos = -halfW;
    else if (anchorX === "right") anchorXPos = halfW;

    if (anchorY === "top") anchorYPos = halfH;
    else if (anchorY === "bottom") anchorYPos = -halfH;

    anchorXPos += offsetX;
    anchorYPos += offsetY;

    const finalZ = -(z + resolvedPos[2]);

    // Position
    g.position.set(
      anchorXPos + resolvedPos[0],
      anchorYPos + resolvedPos[1],
      finalZ
    );

    // Rotation
    g.rotation.set(resolvedRot[0], resolvedRot[1], resolvedRot[2]);

    // Scale
    g.scale.set(...scale);

    g.updateMatrixWorld(true);
  }, [
    anchorX,
    anchorY,
    offsetX,
    offsetY,
    z,
    position,
    rotation,
    scale,
    getCamera,
  ]);

  // Run once on mount + whenever props change
  useEffect(() => {
    updateAnchor();
  }, [updateAnchor]);

  // Subscribe to Stage viewport updates
  useEffect(() => {
    if (!stage.onResizeOrFovChange) return;

    const unsub = stage.onResizeOrFovChange(() => {
      updateAnchor();
    });

    return () => unsub?.();
  }, [stage, updateAnchor]);

  return (
    <ParentContext.Provider value={mountedGroup}>
      {mountedGroup ? children : null}
    </ParentContext.Provider>
  );
}
