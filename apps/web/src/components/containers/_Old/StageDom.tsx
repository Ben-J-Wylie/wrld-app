import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect } from "react";
import { SceneConfig, useSceneStore } from "@/Scene";
import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
import { FitPerspectiveCamera, CameraRig, CameraOverlay } from "@/Scene/Camera";
import { ScrollDomWrapper } from "@/Scene/Controllers";

/**
 * StageDom
 * -----------------------------------------------------------------------------
 * DOM-scrolling version of Stage.
 * The Canvas stays "sticky" in view while the DOM wrapper scrolls.
 */
export function StageDom({ children }: PropsWithChildren) {
  const { lighting, debug } = SceneConfig;
  const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

  const worldHeight =
    useSceneStore((s) => s.worldHeight) ??
    SceneConfig.scene.background.heightWorld;

  // keep store synced with config world height
  useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

  const scene = useThreeStore((s) => s.scene);
  const camera = useThreeStore((s) => s.camera);

  return (
    <ScrollDomWrapper>
      {/* 👇 Sticky canvas — visible at all times, but allows wheel scroll to pass through */}
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{
          position: "sticky", // stay pinned within scroll container
          top: 0,
          width: "100%",
          height: "100vh", // fill the viewport
          pointerEvents: "none", // let scroll/gesture events pass through
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

      {debug.enabled && scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}
    </ScrollDomWrapper>
  );
}
