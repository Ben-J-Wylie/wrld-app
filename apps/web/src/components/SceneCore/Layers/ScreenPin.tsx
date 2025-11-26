import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

type AnchorX = "left" | "center" | "right";
type AnchorY = "top" | "center" | "bottom";

export interface ScreenPinProps {
  children?: React.ReactNode;

  /** Mode 1: Local transforms (simple pinned UI) */
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  /** Mode 2: Frustum Anchoring */
  anchorX?: AnchorX;
  anchorY?: AnchorY;
  offsetX?: number;
  offsetY?: number;
  /** Positive = farther from camera */
  z?: number;
}

export function ScreenPin({
  children,

  // Local mode
  position = [0, 0, -200],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  // Anchor mode
  anchorX,
  anchorY,
  offsetX = 0,
  offsetY = 0,
  z,
}: ScreenPinProps) {
  const { camera, size } = useThree();
  const group = useRef(new THREE.Group()).current;

  // Attach to camera once
  useEffect(() => {
    camera.add(group);
    return () => {
      camera.remove(group);
    };
  }, [camera, group]);

  // Determine which mode we're in
  const isAnchored =
    z !== undefined || anchorX !== undefined || anchorY !== undefined;

  // ----------------------------------------------------
  // ANCHOR MODE: compute frustum-anchored placement
  // ----------------------------------------------------
  const updateAnchor = useCallback(() => {
    if (!isAnchored) return;

    const cam = camera as THREE.PerspectiveCamera;
    const depth = z ?? 200;

    // half-frustum height at depth
    const halfH = depth * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * cam.aspect;

    let ax = 0;
    let ay = 0;

    // horizontal anchor
    if (anchorX === "left") ax = -halfW;
    else if (anchorX === "right") ax = halfW;

    // vertical anchor
    if (anchorY === "top") ay = halfH;
    else if (anchorY === "bottom") ay = -halfH;

    // apply offsets
    ax += offsetX;
    ay += offsetY;

    // apply camera-local translation
    group.position.set(
      ax + position[0],
      ay + position[1],
      -depth // negative = in front of camera
    );

    group.rotation.set(...rotation);
    group.scale.set(...scale);

    group.updateMatrixWorld(true);
  }, [
    isAnchored,
    anchorX,
    anchorY,
    offsetX,
    offsetY,
    z,
    position,
    rotation,
    scale,
    camera,
  ]);

  // run once + on resize/FOV change
  useEffect(() => {
    if (isAnchored) updateAnchor();
  }, [isAnchored, updateAnchor, size.width, size.height]);

  // ----------------------------------------------------
  // LOCAL MODE: simple camera-attached UI
  // ----------------------------------------------------
  useEffect(() => {
    if (isAnchored) return;

    group.position.set(...position);
    group.rotation.set(...rotation);
    group.scale.set(...scale);
    group.updateMatrixWorld(true);
  }, [isAnchored, position, rotation, scale, group]);

  return <primitive object={group}>{children}</primitive>;
}
