// src/components/containers/SceneCore/Layers/ScreenGroup.tsx
import React, { useEffect, useRef, useState } from "react";
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

  /** Child-space offsets (added AFTER anchoring) */
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

  // Create + attach
  useEffect(() => {
    const g = new THREE.Group();
    groupRef.current = g;
    cameraRoot.add(g);
    setMountedGroup(g);

    return () => cameraRoot.remove(g);
  }, []);

  // Anchor update
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;

    const camera = getCamera();
    if (!camera) return;

    // ----------------------------------------
    // FRUSTUM AT DEPTH z
    // ----------------------------------------
    const halfH = z * Math.tan((camera.fov * Math.PI) / 360);
    const halfW = halfH * camera.aspect;

    let anchorXPos = 0;
    let anchorYPos = 0;

    // Horizontal anchor
    if (anchorX === "left") anchorXPos = -halfW;
    else if (anchorX === "right") anchorXPos = halfW;

    // Vertical anchor
    if (anchorY === "top") anchorYPos = +halfH;
    else if (anchorY === "bottom") anchorYPos = -halfH;

    // Apply offsets (world units)
    anchorXPos += offsetX;
    anchorYPos += offsetY;

    // Final world Z (negative because camera looks down -Z)
    const finalZ = -(z + position[2]);

    // ----------------------------------------
    // FINAL WORLD TRANSFORM
    // ----------------------------------------
    g.position.set(anchorXPos + position[0], anchorYPos + position[1], finalZ);

    g.rotation.set(...rotation);
    g.scale.set(...scale);

    g.updateMatrixWorld(true);
  }, [anchorX, anchorY, offsetX, offsetY, z, position, rotation, scale]);

  return (
    <ParentContext.Provider value={mountedGroup}>
      {mountedGroup ? children : null}
    </ParentContext.Provider>
  );
}
