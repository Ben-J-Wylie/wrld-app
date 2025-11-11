// import { Canvas } from "@react-three/fiber";
// import { PerformanceMonitor } from "@react-three/drei";
// import { PropsWithChildren, useEffect } from "react";
// import { SceneConfig, useSceneStore } from "@/Scene";
// import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
// import { FitPerspectiveCamera, CameraRig, CameraOverlay } from "@/Scene/Camera";

// /**
//  * Stage
//  * Root-level Canvas wrapper that mounts all 3D children, cameras, and lights.
//  * Uses Dynamic FOV / Fixed Z mode.
//  */
// export function Stage({ children }: PropsWithChildren) {
//   const { lighting, debug } = SceneConfig;
//   const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

//   const worldHeight =
//     useSceneStore((s) => s.worldHeight) ??
//     SceneConfig.scene.background.heightWorld;

//   // keep store synced with config world height
//   useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

//   const scene = useThreeStore((s) => s.scene);
//   const camera = useThreeStore((s) => s.camera);

//   return (
//     <>
//       <Canvas
//         linear
//         dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
//         gl={{ antialias: true, alpha: true }}
//         style={{ position: "fixed", inset: 0 }}
//       >
//         <PerformanceMonitor />
//         <RegisterThreeObjects />
//         <FitPerspectiveCamera />
//         <CameraRig />
//         <ambientLight intensity={lighting.ambient} />
//         <directionalLight
//           position={lighting.directional.position as [number, number, number]}
//           intensity={lighting.directional.intensity}
//         />
//         {children}
//       </Canvas>

//       {debug.enabled && scene && camera && (
//         <CameraOverlay stageScene={scene} stageCamera={camera} />
//       )}
//     </>
//   );
// }

// import { Canvas } from "@react-three/fiber";
// import { PerformanceMonitor } from "@react-three/drei";
// import { PropsWithChildren, useEffect } from "react";
// import { SceneConfig, useSceneStore } from "@/Scene";
// import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
// import { FitPerspectiveCamera, CameraRig, CameraOverlay } from "@/Scene/Camera";
// import { ScrollDomWrapper } from "@/Scene/Controllers";

// export function Stage({ children }: PropsWithChildren) {
//   const { lighting, debug } = SceneConfig;
//   const setWorldHeight = useSceneStore((s) => s.setWorldHeight);
//   const worldHeight =
//     useSceneStore((s) => s.worldHeight) ??
//     SceneConfig.scene.background.heightWorld;

//   useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

//   const scene = useThreeStore((s) => s.scene);
//   const camera = useThreeStore((s) => s.camera);

//   return (
//     <ScrollDomWrapper>
//       <Canvas
//         linear
//         dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
//         gl={{ antialias: true, alpha: true }}
//         style={{ position: "fixed", inset: 0 }}
//       >
//         <PerformanceMonitor />
//         <RegisterThreeObjects />
//         <FitPerspectiveCamera />
//         <CameraRig />
//         <ambientLight intensity={lighting.ambient} />
//         <directionalLight
//           position={lighting.directional.position as [number, number, number]}
//           intensity={lighting.directional.intensity}
//         />
//         {children}
//       </Canvas>

//       {debug.enabled && scene && camera && (
//         <CameraOverlay stageScene={scene} stageCamera={camera} />
//       )}
//     </ScrollDomWrapper>
//   );
// }

import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect, useState, useMemo } from "react";
import { SceneConfig, useSceneStore } from "@/Scene";
import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
import { FitPerspectiveCamera, CameraRig, CameraOverlay } from "@/Scene/Camera";
import { ScrollController, ScrollDomWrapper } from "@/Scene/Controllers";

/**
 * Stage (Manual Mode)
 * -----------------------------------------------------------------------------
 * A unified Stage that uses either:
 *  - "custom" → ScrollController physics scroll
 *  - "dom" → native DOM scroll via ScrollDomWrapper
 * Pass scrollMode prop to choose; defaults to "custom".
 */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug, scroll } = SceneConfig;
  const scrollMode = scroll.mode;
  const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

  const worldHeight =
    useSceneStore((s) => s.worldHeight) ??
    SceneConfig.scene.background.heightWorld;

  useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

  const scene = useThreeStore((s) => s.scene);
  const camera = useThreeStore((s) => s.camera);

  const Wrapper = useMemo(
    () =>
      scrollMode === "dom"
        ? ScrollDomWrapper
        : ({ children }: { children: React.ReactNode }) => <>{children}</>,
    [scrollMode]
  );

  return (
    <Wrapper>
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: scrollMode === "dom" ? "sticky" : "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100vh",
          pointerEvents: scrollMode === "dom" ? "none" : "auto",
          zIndex: 0,
        }}
      >
        <PerformanceMonitor />
        <RegisterThreeObjects />
        <FitPerspectiveCamera />
        <CameraRig />
        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.directional.position as [number, number, number]}
          intensity={lighting.directional.intensity}
        />
        {children}
      </Canvas>

      {/* Only include ScrollController when using custom physics */}
      {scrollMode === "custom" && <ScrollController />}

      {debug.enabled && scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}
    </Wrapper>
  );
}
