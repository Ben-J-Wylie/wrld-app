// DemoScene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";

import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 100, height: 100 },
  tablet: { width: 200, height: 300 },
  desktop: { width: 300, height: 200 },
};

export function DemoScene() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas>
        {/* ----------------------
            CAMERA SYSTEM
        ---------------------- */}
        <CameraSwitcher />

        {/* ----------------------
            LIGHTING
        ---------------------- */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 300, 400]} intensity={1} castShadow />

        {/* ----------------------
            BACKDROP
        ---------------------- */}
        <Backdrop presetSizes={backdropSizes} breakpoint="desktop" />
      </Canvas>
    </div>
  );
}
