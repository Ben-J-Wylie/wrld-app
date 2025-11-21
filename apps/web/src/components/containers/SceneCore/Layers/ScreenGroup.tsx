// src/components/containers/SceneCore/Layers/ScreenGroup.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

import { useStage } from "../Stage/useStage";
import { ParentContext } from "../Utilities/ParentContext";

type AnchorX = "left" | "center" | "right";
type AnchorY = "top" | "center" | "bottom";

export interface ScreenGroupProps {
  children?: React.ReactNode;

  anchorX?: AnchorX;
  anchorY?: AnchorY;

  offsetX?: number;
  offsetY?: number;

  /** Positive z = farther from camera */
  z?: number;

  /** Local offsets */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

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
  // UPDATE ANCHOR LOGIC (re-run on resize/FOV)
  // ----------------------------------------
  const updateAnchor = useCallback(() => {
    const g = groupRef.current;
    if (!g) return;

    const camera = getCamera();
    if (!camera) return;

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

    const finalZ = -(z + position[2]);

    g.position.set(anchorXPos + position[0], anchorYPos + position[1], finalZ);
    g.rotation.set(...rotation);
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
