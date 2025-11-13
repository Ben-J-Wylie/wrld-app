// src/components/containers/SceneCore/Stage/Stage.tsx
import { Canvas } from "@react-three/fiber"; // React-friendly WebGL renderer
import { PerformanceMonitor, SoftShadows } from "@react-three/drei"; // FPS monitor / adaptive performance
import * as THREE from "three";
import { PropsWithChildren, useMemo } from "react";

// 🧩 Core config + global Zustand store
import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

// 🧠 Helpers: register scene & camera globally for shared access
import {
  RegisterThreeObjects,
  useThreeStore,
} from "@/components/containers/SceneCore/Helpers";

// 🎥 Camera system (auto-fitting FOV, scroll rig, optional overlay)
import {
  FitPerspectiveCamera,
  CameraRig,
  CameraOverlay,
} from "@/components/containers/SceneCore/Cameras";

// 🌀 Scroll systems (two modes)
import {
  ScrollController, // smooth physics-based scroll
  ScrollDomWrapper, // wrapper for native DOM scroll
} from "@/components/containers/SceneCore/Controllers";

// 💡 Scene-wide lights
import {
  AmbientLight,
  DirectionalLight,
} from "@/components/containers/SceneCore/Lights";

/**
 * Stage (Manual Mode)
 * -----------------------------------------------------------------------------
 * The Stage is the root 3D container for all scenes.
 * It mounts a <Canvas> and attaches:
 *   - Camera system
 *   - Lighting
 *   - Scroll system (DOM or custom)
 *   - Optional debug overlay
 *
 * The Stage does not define scene dimensions itself — that’s now handled
 * inside each scene (e.g. DemoScene, AlphaScene).
 */
export function Stage({ children }: PropsWithChildren) {
  // 📦 Pull settings from global SceneConfig
  const { lighting, debug, scroll } = SceneConfig;
  const scrollMode = scroll.mode; // "dom" | "custom"

  // 🧠 Get reactive scene dimensions from Zustand (set by scenes)
  const sceneWidth = useSceneStore((s) => s.sceneWidth);
  const sceneHeight = useSceneStore((s) => s.sceneHeight);

  // 🔗 Access globally shared Three.js references
  const scene = useThreeStore((s) => s.scene);
  const camera = useThreeStore((s) => s.camera);

  // 🧩 Choose scroll wrapper dynamically:
  // If scroll mode is "dom", wrap the Canvas in a ScrollDomWrapper.
  // If "custom", render directly (scrolling handled by ScrollController).
  const Wrapper = useMemo(
    () =>
      scrollMode === "dom"
        ? ScrollDomWrapper
        : ({ children }: { children: React.ReactNode }) => <>{children}</>,
    [scrollMode]
  );

  return (
    <Wrapper>
      {/* 🖼 Main 3D Canvas (React Three Fiber) */}
      <Canvas
        shadows
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{
          antialias: true,
          alpha: true,
          shadowMapEnabled: true,
          shadowMapType: THREE.PCFSoftShadowMap,
        }}
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

        <AmbientLight />
        <DirectionalLight />

        <SoftShadows size={30} samples={40} focus={0.25} />
        {children}
      </Canvas>

      {/* 🧭 Scroll controller (only in "custom" mode) */}
      {scrollMode === "custom" && <ScrollController />}

      {/* 👁 Optional camera debug overlay */}
      {debug.enabled && scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}
    </Wrapper>
  );
}

//                      ┌────────────────────────────┐
//                      │        <Stage />           │
//                      │ Root 3D environment        │
//                      └────────────┬───────────────┘
//                                   │
//                    ┌───────────────┴────────────────┐
//                    │                                │
//                    ▼                                ▼
//         ┌────────────────────┐           ┌────────────────────┐
//         │   SceneConfig      │           │   useSceneStore     │
//         │ (lighting, scroll, │           │ (reactive values:   │
//         │ debug defaults)    │           │  sceneWidth/Height) │
//         └────────────────────┘           └────────────────────┘
//                                   │
//                                   ▼
//                       ┌────────────────────────┐
//                       │  Choose Scroll Wrapper │
//                       │  - DOM → ScrollDomWrapper
//                       │  - Custom → <>{}</>     │
//                       └────────────────────────┘
//                                   │
//                                   ▼
//                       ┌────────────────────────┐
//                       │      <Canvas />        │
//                       │ (React Three Fiber)    │
//                       └────────────────────────┘
//                                   │
//           ┌────────────────────────┼───────────────────────────────┐
//           ▼                        ▼                               ▼
//  ┌────────────────────┐  ┌────────────────────┐          ┌────────────────────┐
//  │ RegisterThreeObjects│  │ FitPerspectiveCamera│         │ CameraRig          │
//  │ Save refs globally  │  │ Adjust FOV to view │         │ Animate camera     │
//  └────────────────────┘  └────────────────────┘          └────────────────────┘
//           │                        │                               │
//           ▼                        ▼                               ▼
//  ┌────────────────────┐  ┌────────────────────┐          ┌────────────────────┐
//  │ DirectionalLight   │  │ {children} layers  │          │ PerformanceMonitor │
//  │ Global illumination│  │ Scene content      │          │ Manage FPS quality │
//  └────────────────────┘  └────────────────────┘          └────────────────────┘
//                                   │
//                                   ▼
//                     ┌───────────────────────────────┐
//                     │ ScrollController (if custom)  │
//                     │ Handles smooth scroll physics │
//                     └───────────────────────────────┘
//                                   │
//                                   ▼
//                     ┌───────────────────────────────┐
//                     │ CameraOverlay (debug view)    │
//                     │ Shows FOV & camera frustum    │
//                     └───────────────────────────────┘
