// src/components/containers/SceneCore/Cameras/useCameraRig.ts
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createCameraRig } from "./CameraRig";

const CAMERA_Z = 1000;

export function useCameraRig(camera: THREE.Camera | null) {
  const rigRef = useRef<ReturnType<typeof createCameraRig> | null>(null);
  const isPerspective = camera instanceof THREE.PerspectiveCamera;

  // Create rig once per camera instance
  useEffect(() => {
    if (!isPerspective || !camera) return;

    const rig = createCameraRig(camera as THREE.PerspectiveCamera, CAMERA_Z);
    rigRef.current = rig;

    // Kick an initial limits compute
    rig.onResizeOrFovChange?.();

    return () => {
      rigRef.current = null;
    };
  }, [isPerspective, camera]);

  // Drive rig every frame
  useFrame(() => {
    if (!isPerspective) return;
    rigRef.current?.onFrameUpdate?.();
  });

  return isPerspective ? rigRef.current : null;
}
