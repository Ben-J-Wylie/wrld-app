import { Canvas } from "@react-three/fiber";
import { PerformanceMonitor } from "@react-three/drei";
import { PropsWithChildren, useEffect, useState } from "react";
import { SceneConfig, useSceneStore } from "@/Scene";
import { RegisterThreeObjects, useThreeStore } from "@/Scene/Helpers";
import { FitPerspectiveCamera, CameraRig } from "@/Scene/Stage";
import { CameraOverlay } from "@/Scene/Camera";

/**
 * Stage
 * Root-level Canvas wrapper that mounts all 3D children, cameras, and lights.
 */
export function Stage({ children }: PropsWithChildren) {
  const { lighting, debug } = SceneConfig;
  const [fovDisplay, setFovDisplay] = useState<number>(
    SceneConfig.camera.baseFov
  );
  const [visHeight, setVisHeight] = useState(0);

  const worldWidth =
    useSceneStore((s) => s.backgroundWidth) ??
    SceneConfig.scene.background.widthWorld;
  const worldHeight =
    useSceneStore((s) => s.backgroundHeight) ??
    SceneConfig.scene.background.heightWorld;
  const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

  useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

  const { scene, camera } = useThreeStore.getState();

  return (
    <>
      <Canvas
        linear
        dpr={[1, Math.min(2, window.devicePixelRatio || 1.5)]}
        gl={{ antialias: true, alpha: true }}
        style={{ position: "fixed", inset: 0 }}
      >
        <PerformanceMonitor />
        <RegisterThreeObjects />
        <FitPerspectiveCamera
          onValuesChange={({ fov, visibleHeight }) => {
            setFovDisplay(fov);
            setVisHeight(visibleHeight);
          }}
        />
        <CameraRig />
        <ambientLight intensity={lighting.ambient} />
        <directionalLight
          position={lighting.directional.position as [number, number, number]}
          intensity={lighting.directional.intensity}
        />
        {children}
      </Canvas>

      {scene && camera && (
        <CameraOverlay stageScene={scene} stageCamera={camera} />
      )}

      {debug.enabled && (
        <div className="debug-overlay">
          <div>FOV: {fovDisplay.toFixed(2)}°</div>
          <div>World Width: {worldWidth.toFixed(3)}</div>
          <div>World Height: {worldHeight.toFixed(3)}</div>
          <div>Visible Height: {visHeight.toFixed(3)}</div>
        </div>
      )}
    </>
  );
}
