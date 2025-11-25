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
import { DirectionalLight } from "./Lights/DirectionalLight";

import { Toggle3D } from "./Toggle3D/Toggle3D";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

// ------------------------------------------------------------------
// InnerScene: lives inside <Canvas>
// ------------------------------------------------------------------
// ------------------------------------------------------------------
// InnerScene: lives inside <Canvas>
// ------------------------------------------------------------------
function InnerScene() {
  const { gl } = useThree();

  const sceneCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orbitCamRef = useRef<THREE.PerspectiveCamera>(null!);

  const cameraRig = useCameraRig(sceneCamRef.current);
  useScrollController(cameraRig, gl.domElement);

  return (
    <>
      <CameraSwitcher sceneCamRef={sceneCamRef} orbitCamRef={orbitCamRef} />

      <ambientLight intensity={0.5} />
      <DirectionalLight />

      {/* Shadow test image plane */}
      <mesh
        position={[0, 0, -50]} // behind toggles
        rotation={[0, 0, 0]} // tilt so shadows show clearly
        castShadow
        receiveShadow
      >
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Test cubes */}
      <mesh position={[800, 0, 0]} castShadow>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="red" />
      </mesh>

      <mesh position={[0, 800, 0]} castShadow>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="blue" />
      </mesh>

      <mesh position={[0, -800, 0]} castShadow>
        <boxGeometry args={[200, 200, 200]} />
        <meshStandardMaterial color="green" />
      </mesh>

      {/* Toggles */}
      <Toggle3D
        width={200}
        height={50}
        position={[0, 10, 20]}
        onChange={(s) => console.log("Toggle state:", s)}
      />
      <Toggle3D
        width={200}
        height={50}
        position={[0, 60, 50]}
        onChange={(s) => console.log("Toggle state:", s)}
      />
      <Toggle3D
        width={200}
        height={50}
        position={[0, -50, 100]}
        onChange={(s) => console.log("Toggle state:", s)}
      />

      <Backdrop />
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
      <Canvas shadows gl={{ outputColorSpace: THREE.SRGBColorSpace }}>
        <InnerScene />
      </Canvas>
    </div>
  );
}
