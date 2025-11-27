// useCameraRig.ts
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createCameraRig } from "./CameraRig";

const CAMERA_Z = 1000;

export function useCameraRig(camera: THREE.Camera | null) {
  const rigRef = useRef<ReturnType<typeof createCameraRig> | null>(null);
  const { size } = useThree();
  const isPerspective = camera instanceof THREE.PerspectiveCamera;

  // (Re)create rig whenever the *scene camera instance* or viewport changes
  useEffect(() => {
    if (!isPerspective || !camera) return;

    rigRef.current = createCameraRig(camera, CAMERA_Z);
    rigRef.current.onResizeOrFovChange?.();
  }, [isPerspective, camera, size.width, size.height]);

  // Drive rig every frame
  useFrame(() => {
    if (!isPerspective) return;
    rigRef.current?.onFrameUpdate?.();
  });

  return isPerspective ? rigRef.current : null;
}
