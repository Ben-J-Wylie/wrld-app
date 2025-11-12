import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

interface FitPerspectiveCameraProps {
  onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
}

/**
 * FitPerspectiveCamera
 * Dynamically adjusts FOV to fit world width across viewport aspect ratio.
 * Updates Zustand store with FOV and visible height each frame.
 */
export function FitPerspectiveCamera({
  onValuesChange,
}: FitPerspectiveCameraProps) {
  const { camera, size } = useThree();
  const setViewport = useSceneStore((s) => s.setViewport);
  const setVisibleHeight = useSceneStore((s) => s.setVisibleHeight);
  const setFov = useSceneStore((s) => s.setFov); // ✅ added line

  const bgWidth =
    useSceneStore((s) => s.worldWidth) ??
    SceneConfig.scene.background.worldWidth;

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

    // ✅ update both Zustand + external callback
    setFov(cam.fov);
    setVisibleHeight(visibleHeight);
    onValuesChange?.({ fov: cam.fov, visibleHeight });
  }, [
    size,
    bgWidth,
    camera,
    setViewport,
    onValuesChange,
    setVisibleHeight,
    setFov,
  ]);

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    const distance = SceneConfig.camera.positionZ;
    const fovDeg =
      (2 * Math.atan(bgWidth / 2 / (distance * aspect)) * 180) / Math.PI;

    // Smoothly interpolate toward target FOV
    fovTarget.current += (fovDeg - fovTarget.current) * 0.1;
    cam.fov = fovTarget.current;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();

    const visibleHeight = 2 * distance * Math.tan((cam.fov * Math.PI) / 360);

    // ✅ update both Zustand + external callback
    setFov(cam.fov);
    setVisibleHeight(visibleHeight);
    onValuesChange?.({ fov: cam.fov, visibleHeight });
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

// import * as THREE from "three";
// import { useThree, useFrame } from "@react-three/fiber";
// import { PerspectiveCamera } from "@react-three/drei";
// import { useEffect, useRef } from "react";
// import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

// interface FitPerspectiveCameraProps {
//   onValuesChange?: (vals: { fov: number; visibleHeight: number }) => void;
// }

// /**
//  * FitPerspectiveCamera
//  * Fits FOV to the CURRENT worldHeight (reactive), so height is fully visible.
//  * Updates Zustand store with FOV and visible height.
//  */
// export function FitPerspectiveCamera({
//   onValuesChange,
// }: FitPerspectiveCameraProps) {
//   const { camera, size } = useThree();
//   const setViewport = useSceneStore((s) => s.setViewport);
//   const setVisibleHeight = useSceneStore((s) => s.setVisibleHeight);
//   const setFov = useSceneStore((s) => s.setFov);

//   // 🔑 Use reactive worldHeight (fallback to config)
//   const worldHeight =
//     useSceneStore((s) => s.worldHeight) ??
//     SceneConfig.scene.background.heightWorld;

//   const fovTarget = useRef<number>(SceneConfig.camera.baseFov);

//   useEffect(() => {
//     setViewport(size.width, size.height);
//   }, [size.width, size.height, setViewport]);

//   // Compute FOV from HEIGHT (not width). Aspect still set on camera.
//   const updateCamera = (fitHeight: number) => {
//     const cam = camera as THREE.PerspectiveCamera;
//     const aspect = size.width / size.height;
//     const z = SceneConfig.camera.positionZ;

//     const fovDeg = (2 * Math.atan(fitHeight / (2 * z)) * 180) / Math.PI;

//     fovTarget.current = fovDeg;
//     cam.fov = fovDeg;
//     cam.aspect = aspect;
//     cam.updateProjectionMatrix();

//     const visibleHeight = 2 * z * Math.tan((fovDeg * Math.PI) / 360);
//     setFov(cam.fov);
//     setVisibleHeight(visibleHeight);
//     onValuesChange?.({ fov: cam.fov, visibleHeight });
//   };

//   useEffect(() => {
//     updateCamera(worldHeight);
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [worldHeight, size.width, size.height, camera]);

//   useFrame(() => {
//     const cam = camera as THREE.PerspectiveCamera;
//     const aspect = size.width / size.height;
//     const z = SceneConfig.camera.positionZ;
//     const targetFov = (2 * Math.atan(worldHeight / (2 * z)) * 180) / Math.PI;

//     // Smooth toward target
//     fovTarget.current += (targetFov - fovTarget.current) * 0.1;
//     cam.fov = fovTarget.current;
//     cam.aspect = aspect;
//     cam.updateProjectionMatrix();

//     const visibleHeight = 2 * z * Math.tan((cam.fov * Math.PI) / 360);
//     setFov(cam.fov);
//     setVisibleHeight(visibleHeight);
//     onValuesChange?.({ fov: cam.fov, visibleHeight });
//   });

//   return (
//     <PerspectiveCamera
//       makeDefault
//       position={[0, 0, SceneConfig.camera.positionZ]}
//       near={SceneConfig.camera.near}
//       far={SceneConfig.camera.far}
//     />
//   );
// }
