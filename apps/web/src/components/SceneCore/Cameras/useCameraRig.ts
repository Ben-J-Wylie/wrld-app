// useCameraRig.ts
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createCameraRig } from "./CameraRig";

const CAMERA_Z = 1000;

export function useCameraRig(camera: THREE.Camera | null) {
  const rigRef = useRef<any>(null);
  const { size } = useThree();

  // If camera is NOT a perspective camera → do nothing
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    return null;
  }

  useEffect(() => {
    if (!camera) return;

    rigRef.current = createCameraRig(camera, CAMERA_Z);
    rigRef.current.onResizeOrFovChange();
  }, [camera, size.width, size.height]);

  useFrame(() => {
    rigRef.current?.onFrameUpdate?.();
  });

  return rigRef.current;
}
