// DemoScene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";

import { useBreakpoint } from "./Utilities/Breakpoints";
import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 100, height: 100 },
  tablet: { width: 200, height: 300 },
  desktop: { width: 300, height: 200 },
};

export function DemoScene() {
  const breakpoint = useBreakpoint(); // 👈 watch viewport + return correct bp

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas>
        <CameraSwitcher />

        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 300, 400]} intensity={1} castShadow />

        {/* This will now update automatically */}
        <Backdrop presetSizes={backdropSizes} breakpoint={breakpoint} />
      </Canvas>
    </div>
  );
}
