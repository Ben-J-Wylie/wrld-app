import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import { useEffect, useRef } from "react";
import { SceneConfig, useSceneStore } from "@/components/containers/SceneCore";

function ObserverScene({
  sharedScene,
  stageCamera,
}: {
  sharedScene: THREE.Scene;
  stageCamera: THREE.Camera;
}) {
  const observerCam = useRef<THREE.PerspectiveCamera>(null!);
  const helper = useRef<THREE.CameraHelper | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    const h = new THREE.CameraHelper(stageCamera);
    scene.add(h);
    helper.current = h;
    return () => {
      scene.remove(h);
      h.geometry.dispose();
      (h.material as THREE.Material).dispose();
    };
  }, [scene, stageCamera]);

  useFrame(() => helper.current?.update());

  return (
    <>
      <PerspectiveCamera
        ref={observerCam}
        makeDefault
        position={[8, 5, 8]}
        fov={50}
      />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <primitive object={sharedScene} />
    </>
  );
}

/**
 * CameraOverlay
 * --------------------------------------------------
 * Picture-in-Picture viewport + minimal debug readout.
 * Dynamic FOV / Fixed Z mode only.
 */
export function CameraOverlay({
  stageScene,
  stageCamera,
}: {
  stageScene: THREE.Scene;
  stageCamera: THREE.Camera;
}) {
  // ✅ pull all live data straight from the store
  const fovDisplay = useSceneStore((s) => s.fov);
  const visibleHeight = useSceneStore((s) => s.visibleHeight);
  const worldWidth =
    useSceneStore((s) => s.worldWidth) ??
    SceneConfig.scene.background.worldWidth;
  const worldHeight =
    useSceneStore((s) => s.worldHeight) ??
    SceneConfig.scene.background.worldHeight;

  return (
    <>
      {/* 🎥 PiP viewport */}
      <Canvas
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "25vw",
          height: "25vh",
          border: "1px solid rgba(255,255,255,0.3)",
          borderRadius: "8px",
          background: "rgba(0,0,0,0.1)",
          pointerEvents: "auto",
        }}
      >
        <ObserverScene sharedScene={stageScene} stageCamera={stageCamera} />
      </Canvas>

      {/* 🧾 Debug overlay */}
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
        <div>FOV: {fovDisplay.toFixed(2)}°</div>
        <div>World Width: {worldWidth.toFixed(3)}</div>
        <div>World Height: {worldHeight.toFixed(3)}</div>
        <div>Visible Height: {visibleHeight.toFixed(3)}</div>
      </div>
    </>
  );
}
