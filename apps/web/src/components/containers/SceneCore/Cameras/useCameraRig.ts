// src/components/containers/SceneCore/Cameras/useCameraRig.ts
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { createCameraRig } from "./CameraRig";
import { getSceneCameraZ } from "./SceneCameraRegistry";

export function useCameraRig(camera: THREE.Camera | null) {
  const rigRef = useRef<ReturnType<typeof createCameraRig> | null>(null);
  const isPerspective = camera instanceof THREE.PerspectiveCamera;

  useEffect(() => {
    if (!isPerspective || !camera) return;

    const cameraZ = getSceneCameraZ(); // <-- the single source of truth

    const rig = createCameraRig(camera as THREE.PerspectiveCamera, cameraZ);
    rigRef.current = rig;

    rig.onResizeOrFovChange?.();

    return () => {
      rigRef.current = null;
    };
  }, [isPerspective, camera]);

  useFrame(() => {
    if (!isPerspective) return;
    rigRef.current?.onFrameUpdate?.();
  });

  return isPerspective ? rigRef.current : null;
}
