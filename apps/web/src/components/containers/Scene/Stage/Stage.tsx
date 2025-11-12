import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { PropsWithChildren, useEffect, useMemo } from "react";
import { SceneConfig, useSceneStore } from "@/Scene";
import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
import {
  FitPerspectiveCamera,
  CameraRig,
  CameraOverlay,
} from "@/components/containers/Scene/Cameras";
import { ScrollController, ScrollDomWrapper } from "@/Scene/Controllers";
import { DirectionalLight, PointLight } from "@/Scene/Lights";

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
        shadows={{ type: THREE.PCFSoftShadowMap }} // softer
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
        {/* 🔧 System & Camera Setup */}
        <PerformanceMonitor />
        <RegisterThreeObjects />
        <FitPerspectiveCamera />
        <CameraRig />

        <DirectionalLight />
        <PointLight />

        {/* 🎨 Scene Layers */}
        {children}
      </Canvas>

      {/* Only include ScrollController when using custom physics */}
      {scrollMode === "custom" && <ScrollController />}

      {/* 👁 Debug overlay */}
      {debug.enabled && scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}
    </Wrapper>
  );
}
