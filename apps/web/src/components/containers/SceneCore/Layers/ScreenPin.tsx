import React, { useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { getSceneCamera } from "../Cameras/SceneCameraRegistry";

type AnchorX = "left" | "center" | "right";
type AnchorY = "top" | "center" | "bottom";

export interface ScreenPinProps {
  children?: React.ReactNode;

  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  anchorX?: AnchorX;
  anchorY?: AnchorY;
  offsetX?: number;
  offsetY?: number;
  z?: number;
}

export function ScreenPin({
  children,
  position = [0, 0, -200],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],

  anchorX,
  anchorY,
  offsetX = 0,
  offsetY = 0,
  z,
}: ScreenPinProps) {
  const group = useRef(new THREE.Group()).current;
  const { size } = useThree();

  const sceneCamera = getSceneCamera(); // ⭐ always SceneCamera

  // Attach to SceneCamera
  useEffect(() => {
    if (!sceneCamera) return;
    sceneCamera.add(group);
    return () => {
      sceneCamera.remove(group);
    };
  }, [sceneCamera, group]);

  const isAnchored =
    z !== undefined || anchorX !== undefined || anchorY !== undefined;

  // ANCHOR MODE
  const updateAnchor = useCallback(() => {
    if (!isAnchored || !sceneCamera) return;

    const cam = sceneCamera as THREE.PerspectiveCamera;
    const depth = z ?? 200;

    const halfH = depth * Math.tan((cam.fov * Math.PI) / 360);
    const halfW = halfH * cam.aspect;

    let ax = 0;
    let ay = 0;

    if (anchorX === "left") ax = -halfW;
    else if (anchorX === "right") ax = halfW;

    if (anchorY === "top") ay = halfH;
    else if (anchorY === "bottom") ay = -halfH;

    ax += offsetX;
    ay += offsetY;

    group.position.set(ax + position[0], ay + position[1], -depth);

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
    sceneCamera,
  ]);

  useEffect(() => {
    if (isAnchored) updateAnchor();
  }, [isAnchored, updateAnchor, size.width, size.height]);

  // LOCAL MODE
  useEffect(() => {
    if (isAnchored || !sceneCamera) return;

    group.position.set(...position);
    group.rotation.set(...rotation);
    group.scale.set(...scale);
    group.updateMatrixWorld(true);
  }, [isAnchored, position, rotation, scale, sceneCamera]);

  return <primitive object={group}>{children}</primitive>;
}
