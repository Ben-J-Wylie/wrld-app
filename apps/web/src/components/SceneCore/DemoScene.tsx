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
  const { camera, gl } = useThree();
  const cameraRig = useCameraRig(camera as THREE.PerspectiveCamera);
  useScrollController(cameraRig, gl.domElement);

  return (
    <>
      <CameraSwitcher />

      <ambientLight intensity={0.6} />
      <directionalLight position={[300, 500, 400]} intensity={1} castShadow />

      {/* ------------------------------
         TEST OBJECTS TO SEE SCROLLING
         ------------------------------ */}

      {/* Center cube */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[300, 300, 300]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Right → red box */}
      <mesh position={[800, 0, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="red" />
      </mesh>

      {/* Top → blue box */}
      <mesh position={[0, 800, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="blue" />
      </mesh>

      {/* Bottom → green box */}
      <mesh position={[0, -800, 0]}>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="green" />
      </mesh>

      {/* Backdrop (reads size from store) */}
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
  }, [breakpoint]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas>
        <InnerScene />
      </Canvas>
    </div>
  );
}
