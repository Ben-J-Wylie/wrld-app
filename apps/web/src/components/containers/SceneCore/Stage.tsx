// src/components/containers/SceneCore/Stage/Stage.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";

import { useSceneStore } from "./Store/SceneStore";
import { useBreakpointListener } from "./Utilities/Breakpoints";

import { enablePCSS } from "./Shadows/PCSS";

import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { useCameraRig } from "./Cameras/useCameraRig";
import { useScrollController } from "./Controllers/useScrollController";

import { AmbientLight } from "./Lights/AmbientLight";
import { DirectionalLight } from "./Lights/DirectionalLight";

/** --------------------------------------
 *  Props for Stage
 * -------------------------------------*/
export interface StageProps {
  /** Backdrop dimensions by breakpoint */
  backdrop: {
    mobile: { width: number; height: number };
    tablet: { width: number; height: number };
    desktop: { width: number; height: number };
  };

  /** Children to render inside the 3D world */
  children?: React.ReactNode;

  /** Optional background colour */
  background?: string;
}

/* ---------------------------------------------------------------------------
 * InnerScene — Hidden from user. Sets up PCSS, Camera Rig, Scroll, Lights
 * ---------------------------------------------------------------------------*/
function InnerScene({ children }: { children?: React.ReactNode }) {
  const { gl } = useThree();

  const sceneCamRef = useRef<THREE.PerspectiveCamera>(null!);
  const orbitCamRef = useRef<THREE.PerspectiveCamera>(null!);

  // CameraRig & Scroll Physics
  const cameraRig = useCameraRig(sceneCamRef.current);
  useScrollController(cameraRig, gl.domElement);

  return (
    <>
      {/* Camera System */}
      <CameraSwitcher sceneCamRef={sceneCamRef} orbitCamRef={orbitCamRef} />

      {/* Lighting */}
      <AmbientLight />
      <DirectionalLight
        followSceneCamera
        followOffset={[0, 0, -500]}
        targetOffset={[0, -50, -1000]}
      />

      {/* User's 3D Scene */}
      {children}
    </>
  );
}

/* ---------------------------------------------------------------------------
 * Stage — The public API for scene building
 * ---------------------------------------------------------------------------*/
export function Stage({
  children,
  backdrop,
  background = "#ffffff",
}: StageProps) {
  useBreakpointListener();

  const breakpoint = useSceneStore((s) => s.breakpoint);
  const setSceneSize = useSceneStore((s) => s.setSceneSize);

  // Update scene dimensions when breakpoint changes
  useEffect(() => {
    const dims = backdrop[breakpoint];
    setSceneSize(dims.width, dims.height);
  }, [breakpoint, backdrop, setSceneSize]);

  return (
    <div style={{ width: "100vw", height: "100vh", background }}>
      <Canvas
        shadows
        gl={{ outputColorSpace: THREE.SRGBColorSpace }}
        onCreated={({ gl }) => {
          enablePCSS(gl); // 32-tap stable PCSS, no blue noise
        }}
      >
        <InnerScene>{children}</InnerScene>
      </Canvas>
    </div>
  );
}
