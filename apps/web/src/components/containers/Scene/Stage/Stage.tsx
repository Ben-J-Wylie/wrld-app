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

  const [mode, setMode] = useState<"A" | "B">("A");
  const [fovDisplay, setFovDisplay] = useState(SceneConfig.camera.baseFov);
  const [visHeight, setVisHeight] = useState(0);
  const [zDisplay, setZDisplay] = useState(SceneConfig.camera.positionZ);
  const [bgWidth, setBgWidth] = useState(
    SceneConfig.scene.background.widthWorld
  );

  const worldWidth =
    useSceneStore((s) => s.backgroundWidth) ??
    SceneConfig.scene.background.widthWorld;
  const worldHeight =
    useSceneStore((s) => s.backgroundHeight) ??
    SceneConfig.scene.background.heightWorld;
  const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

  useEffect(() => setWorldHeight(worldHeight), [worldHeight, setWorldHeight]);

  // Key shortcut: press T to toggle camera mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "t") {
        setMode((m) => (m === "A" ? "B" : "A"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        <>
          <div
            className="debug-overlay"
            style={{
              position: "fixed",
              bottom: "48px",
              left: "12px",
              background: "rgba(0,0,0,0.7)",
              color: "#fff",
              padding: "8px 12px",
              fontFamily: "monospace",
              fontSize: "12px",
              borderRadius: "4px",
              zIndex: 9999,
            }}
          >
            <div>
              Mode:{" "}
              {mode === "A" ? "Dynamic FOV / Fixed Z" : "Fixed FOV / Dynamic Z"}
            </div>
            {mode === "A" ? (
              <div>FOV: {fovDisplay.toFixed(2)}°</div>
            ) : (
              <div>Camera Z: {zDisplay.toFixed(2)}</div>
            )}
            <div>World Width: {worldWidth.toFixed(3)}</div>
            <div>World Height: {worldHeight.toFixed(3)}</div>
            <div>Visible Height: {visHeight.toFixed(3)}</div>
            <div>BG Width: {bgWidth.toFixed(2)}</div>
            <div>Press “T” to toggle</div>
          </div>

          <button
            onClick={() => setMode((m) => (m === "A" ? "B" : "A"))}
            style={{
              position: "fixed",
              bottom: "8px",
              left: "12px",
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontFamily: "monospace",
              fontSize: "12px",
              border: "1px solid #666",
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              zIndex: 9999,
            }}
          >
            Toggle Mode [T]
          </button>
        </>
      )}
    </>
  );
}
