// src/components/containers/SceneCore/Stage/Stage.tsx
import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import * as THREE from "three";
import { PropsWithChildren, useEffect, useMemo } from "react";
import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";
import {
  RegisterThreeObjects,
  useThreeStore,
} from "@/components/containers/SceneCore/Helpers";
import {
  FitPerspectiveCamera,
  CameraRig,
  CameraOverlay,
} from "@/components/containers/SceneCore/Cameras";
import {
  ScrollController,
  ScrollDomWrapper,
} from "@/components/containers/SceneCore/Controllers";
import {
  DirectionalLight,
  PointLight,
} from "@/components/containers/SceneCore/Lights";

/**
 * Stage (Manual Mode)
 * -----------------------------------------------------------------------------
 * A unified Stage that uses either:
 *  - "custom" → ScrollController physics scroll
 *  - "dom" → native DOM scroll via ScrollDomWrapper
 * Reactively responds to SceneStore overrides (e.g., sceneWidth, sceneHeight).
 */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug, scroll } = SceneConfig;
  const scrollMode = scroll.mode;

  // 🧠 Scene dimension store (reactive overrides)
  const sceneWidth = useSceneStore((s) => s.sceneWidth);
  const sceneHeight = useSceneStore((s) => s.sceneHeight);
  const setSceneWidth = useSceneStore((s) => s.setSceneWidth);
  const setSceneHeight = useSceneStore((s) => s.setSceneHeight);

  // 🪄 Initialize defaults only if store is empty
  useEffect(() => {
    const { sceneWidth: w, sceneHeight: h } = useSceneStore.getState();
    if (w == null) setSceneWidth(SceneConfig.scene.background.sceneWidth);
    if (h == null) setSceneHeight(SceneConfig.scene.background.sceneHeight);
  }, [setSceneWidth, setSceneHeight]);

  // 📦 Access shared three.js refs
  const scene = useThreeStore((s) => s.scene);
  const camera = useThreeStore((s) => s.camera);

  // 🧩 Choose wrapper type based on scroll mode
  const Wrapper = useMemo(
    () =>
      scrollMode === "dom"
        ? ScrollDomWrapper
        : ({ children }: { children: React.ReactNode }) => <>{children}</>,
    [scrollMode]
  );

  // ✅ Log to verify reactive overrides
  useEffect(() => {
    console.log("Stage scene dimensions:", {
      sceneWidth,
      sceneHeight,
    });
  }, [sceneWidth, sceneHeight]);

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

        {/* 💡 Global lights */}
        <DirectionalLight />
        <PointLight />

        {/* 🎨 Scene Layers */}
        {children}
      </Canvas>

      {/* 🧭 Only include ScrollController when using custom physics */}
      {scrollMode === "custom" && <ScrollController />}

      {/* 👁 Debug overlay */}
      {debug.enabled && scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}
    </Wrapper>
  );
}
