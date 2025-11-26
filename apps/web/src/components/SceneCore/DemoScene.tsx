// DemoScene.tsx
import * as THREE from "three";
import React, { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";

import { useSceneStore } from "./Store/SceneStore";
import { useBreakpointListener } from "./Utilities/Breakpoints";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";

import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { DirectionalLight } from "./Lights/DirectionalLight";
import { Toggle3D } from "./Toggle3D/Toggle3D";

import { useCameraRig } from "./Cameras/useCameraRig";
import { useScrollController } from "./Controllers/useScrollController";

import { ImagePlane } from "./Geometry/ImagePlane";

import { enablePCSS } from "./Shaders/PCSS";

import { printShadowChunk } from "./Shaders/DebugShaderChunk";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

// -----------------------------------------------------
// Inner Three.js scene
// -----------------------------------------------------
function InnerScene() {
  const { gl } = useThree();

  const sceneCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orbitCamRef = useRef<THREE.PerspectiveCamera>(null!);

  const cameraRig = useCameraRig(sceneCamRef.current);
  useScrollController(cameraRig, gl.domElement);

  return (
    <>
      <CameraSwitcher sceneCamRef={sceneCamRef} orbitCamRef={orbitCamRef} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <DirectionalLight />

      {/* -----------------------------------------------------
          Test Image Planes
         ----------------------------------------------------- */}
      <ImagePlane
        color="#ffdd33"
        width={{ mobile: 50, tablet: 50, desktop: 50 }}
        height={{ mobile: 50, tablet: 50, desktop: 50 }}
        position={{
          mobile: [-200, 200, 10],
          tablet: [300, -150, 50],
          desktop: [-400, 100, 300],
        }}
        rotation={{
          mobile: [45, 0, 0],
          tablet: [0, 45, 0],
          desktop: [0, 0, 0],
        }}
        scale={{
          mobile: [10, 1, 1],
          tablet: [1, 10, 1],
          desktop: [1, 1, 10],
        }}
        castShadow
        receiveShadow
      />

      <ImagePlane
        color="#33aaff"
        z={2}
        position={{
          mobile: [50, -100, 500],
          tablet: [100, -150, 500],
          desktop: [150, -200, 500],
        }}
        width={{ mobile: 120, tablet: 140, desktop: 200 }}
        height={{ mobile: 60, tablet: 70, desktop: 100 }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [0.9, 0.9, 1],
          desktop: [0.8, 0.8, 1],
        }}
        castShadow
        receiveShadow
      />

      <ImagePlane
        color="#44ff88"
        z={1}
        position={{
          mobile: [0, 0, 500],
          tablet: [0, -150, 500],
          desktop: [0, 0, 500],
        }}
        width={{
          mobile: 100,
          tablet: 200,
          desktop: 320,
        }}
        height={{
          mobile: 50,
          tablet: 100,
          desktop: 50,
        }}
        castShadow
        receiveShadow
      />

      <Toggle3D width={200} height={50} position={[0, 10, 20]} />
      <Toggle3D width={200} height={50} position={[0, 60, 50]} />
      <Toggle3D width={200} height={50} position={[0, -50, 100]} />

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
    printShadowChunk();
  }, []);
  useEffect(() => {
    const preset = backdropSizes[breakpoint];
    setSceneSize(preset.width, preset.height);
  }, [breakpoint, setSceneSize]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas
        shadows
        gl={{ outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => {
          enablePCSS(gl);
        }}
      >
        <InnerScene />
      </Canvas>
    </div>
  );
}
