import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { SceneConfig, useSceneStore } from "@/Scene";

interface FitPerspectiveCameraProps {
  onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
}

/**
 * FitPerspectiveCamera
 * Dynamically adjusts FOV to fit world width across viewport aspect ratio.
 */
export function FitPerspectiveCamera({
  onValuesChange,
}: FitPerspectiveCameraProps) {
  const { camera, size } = useThree();
  const setViewport = useSceneStore((s) => s.setViewport);
  const setVisibleHeight = useSceneStore((s) => s.setVisibleHeight);

  const bgWidth =
    useSceneStore((s) => s.backgroundWidth) ??
    SceneConfig.scene.background.widthWorld;

  const fovTarget = useRef<number>(SceneConfig.camera.baseFov);

  useEffect(() => {
    setViewport(size.width, size.height);

    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = SceneConfig.camera.positionZ;
    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    fovTarget.current = fovDeg;
    cam.fov = fovDeg;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((fovDeg * Math.PI) / 360);
    onValuesChange?.({ fov: cam.fov, visibleHeight });
    setVisibleHeight(visibleHeight);
  }, [size, bgWidth, camera, setViewport, onValuesChange, setVisibleHeight]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = SceneConfig.camera.positionZ;
    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    fovTarget.current += (fovDeg - fovTarget.current) * 0.1;
    cam.fov = fovTarget.current;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);
    onValuesChange?.({ fov: cam.fov, visibleHeight });
    setVisibleHeight(visibleHeight);
  });

  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 0, SceneConfig.camera.positionZ]}
      near={SceneConfig.camera.near}
      far={SceneConfig.camera.far}
    />
  );
}
