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
      <ambientLight intensity={0.5} />
      <DirectionalLight />

      {/* ===========================================================
          IMAGE PLANE #1 — simple responsive width/height
         =========================================================== */}
      <ImagePlane
        color="#ffdd33"
        width={{ mobile: 20, tablet: 160, desktop: 80 }}
        height={{ mobile: 200, tablet: 80, desktop: 100 }}
        position={{
          mobile: [-200, 200, 1000],
          tablet: [300, -150, 1000],
          desktop: [-400, 100, 300],
        }}
        rotation={{
          mobile: [45, 0, 0],
          tablet: [0, 45, 0],
          desktop: [0, 0, 45],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [1.2, 20, 1],
          desktop: [8.4, 5.4, 3],
        }}
        castShadow
        receiveShadow
      />

      {/* ===========================================================
          IMAGE PLANE #2 — rotation + z layering + scale changes
         =========================================================== */}
      <ImagePlane
        color="#33aaff"
        z={250}
        position={{
          mobile: [50, -100, 0],
          tablet: [100, -150, 0],
          desktop: [150, -200, 0],
        }}
        width={{ mobile: 120, tablet: 140, desktop: 200 }}
        height={{ mobile: 60, tablet: 70, desktop: 100 }}
        rotation={{
          mobile: [0, 0, 0],
          tablet: [0.3, 0.2, 0],
          desktop: [0.5, 0.4, 0],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [0.9, 0.9, 1],
          desktop: [0.8, 0.8, 1],
        }}
        castShadow
        receiveShadow
      />

      {/* ===========================================================
          IMAGE PLANE #3 — full responsive everything (complex)
         =========================================================== */}
      <ImagePlane
        color="#44ff88"
        z={400}
        position={{
          mobile: [200, 200, 0],
          tablet: [300, 100, 0],
          desktop: [500, 50, 0],
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
        rotation={{
          mobile: [0, 0, 0],
          tablet: [0, 0.3, 0.1],
          desktop: [0.2, 0.5, 0.1],
        }}
        scale={{
          mobile: [1, 1, 1],
          tablet: [1.5, 1.5, 1],
          desktop: [2, 2, 1],
        }}
        castShadow
        receiveShadow
      />

      {/* Toggles just for sanity / shadow tests */}
      <Toggle3D width={200} height={50} position={[0, 10, 20]} />
      <Toggle3D width={200} height={50} position={[0, 60, 50]} />
      <Toggle3D width={200} height={50} position={[0, -50, 100]} />

      <Backdrop />
    </>
  );
}

// -----------------------------------------------------
// Outer DemoScene component
// -----------------------------------------------------
export function DemoScene() {
  useBreakpointListener(); // listens for window resize

  const breakpoint = useSceneStore((s) => s.breakpoint);
  const setSceneSize = useSceneStore((s) => s.setSceneSize);

  // update Backdrop size whenever breakpoint changes
  useEffect(() => {
    const preset = backdropSizes[breakpoint];
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
