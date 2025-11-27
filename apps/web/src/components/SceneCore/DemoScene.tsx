// DemoScene.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { Canvas, useLoader, useThree } from "@react-three/fiber";

import { useSceneStore } from "./Store/SceneStore";
import { useBreakpointListener } from "./Utilities/Breakpoints";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";

import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { DirectionalLight } from "./Lights/DirectionalLight";
import { Toggle3D } from "./Toggle3D/Toggle3D";

import { useCameraRig } from "./Cameras/useCameraRig";
import { useScrollController } from "./Controllers/useScrollController";

import { ImagePlane } from "./Geometry/ImagePlane";

import { Group } from "./Layers/Group";
import { ScreenPin } from "./Layers/ScreenPin";

import { enablePCSS } from "./Shaders/PCSS"; // ← 32-tap stable PCSS

const backdropSizes: BackdropDimensions = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

// -----------------------------------------------------
// Inner Three.js scene
// -----------------------------------------------------
function InnerScene() {
  const { scene, gl } = useThree();

  const sceneCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orbitCamRef = useRef<THREE.PerspectiveCamera>(null!);

  const cameraRig = useCameraRig(sceneCamRef.current);
  useScrollController(cameraRig, gl.domElement);

  // -----------------------------------------------------
  // NO BLUE-NOISE — clean, stable PCSS
  // -----------------------------------------------------

  return (
    <>
      <CameraSwitcher sceneCamRef={sceneCamRef} orbitCamRef={orbitCamRef} />

      <ambientLight intensity={0.4} />
      <DirectionalLight />

      {/* <ScreenPin position={[0, 0, -950]}> */}
      <ScreenPin
        anchorX="center"
        anchorY="top"
        z={950}
        offsetX={0}
        offsetY={-25}
      >
        <Toggle3D width={200} height={50} position={[0, 0, 0]} />
      </ScreenPin>
      <Group
        position={{
          mobile: [0, 0, 0],
          tablet: [0, 0, 0],
          desktop: [0, 0, 100],
        }}
        rotation={{
          mobile: [0, 0, 0],
          tablet: [0, 0, 0],
          desktop: [0, 0, 0],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [1, 1, 1],
          desktop: [1, 1, 1],
        }}
      >
        <Toggle3D width={200} height={50} position={[-200, 10, 20]} />
        <Toggle3D width={200} height={50} position={[-200, 60, 50]} />
        <Toggle3D width={200} height={50} position={[-200, -50, 100]} />
      </Group>
      <Backdrop />
    </>
  );
}

// -----------------------------------------------------
// Outer DemoScene
// -----------------------------------------------------
export function DemoScene() {
  useBreakpointListener();

  const breakpoint = useSceneStore((s) => s.breakpoint);
  const setSceneSize = useSceneStore((s) => s.setSceneSize);

  useEffect(() => {
    const preset = backdropSizes[breakpoint];
    setSceneSize(preset.width, preset.height);
  }, [breakpoint, setSceneSize]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas
        shadows
        gl={{ outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => enablePCSS(gl)} // ← only PCSS
      >
        <InnerScene />
      </Canvas>
    </div>
  );
}
