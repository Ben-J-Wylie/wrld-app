// DemoScene.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";

import { useBreakpoint } from "./Utilities/Breakpoints";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";
import { useSceneStore } from "./Store/SceneStore";
import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { useCameraRig } from "./Cameras/useCameraRig";
import { useScrollController } from "./Controllers/useScrollController";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

// ------------------------------------------------------------------
// InnerScene: lives inside <Canvas>
// ------------------------------------------------------------------
function InnerScene() {
  const { gl } = useThree();

  // Explicit refs for each camera
  const sceneCamRef = useRef<THREE.PerspectiveCamera | null>(null);
  const orbitCamRef = useRef<THREE.PerspectiveCamera | null>(null);

  // ✅ CameraRig is bound ONLY to the SceneCamera
  const cameraRig = useCameraRig(sceneCamRef.current);
  useScrollController(cameraRig, gl.domElement);

  return (
    <>
      {/* CameraSwitcher just toggles which camera is active in R3F,
          but the rig/scroll always talk to sceneCamRef only. */}
      <CameraSwitcher sceneCamRef={sceneCamRef} orbitCamRef={orbitCamRef} />

      <ambientLight intensity={0.6} />
      <directionalLight position={[300, 500, 400]} intensity={1} castShadow />

      {/* Test objects */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[300, 300, 300]} />
        <meshStandardMaterial color="white" />
      </mesh>

      <mesh position={[800, 0, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="red" />
      </mesh>

      <mesh position={[0, 800, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="blue" />
      </mesh>

      <mesh position={[0, -800, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="green" />
      </mesh>

      <Backdrop color="#222" />
    </>
  );
}

// ------------------------------------------------------------------
// DemoScene Wrapper
// ------------------------------------------------------------------
export function DemoScene() {
  const breakpoint = useBreakpoint();
  const setSceneSize = useSceneStore((s) => s.setSceneSize);

  useEffect(() => {
    const preset = backdropSizes[breakpoint] ?? backdropSizes.desktop;
    setSceneSize(preset.width, preset.height);
  }, [breakpoint, setSceneSize]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas>
        <InnerScene />
      </Canvas>
    </div>
  );
}
