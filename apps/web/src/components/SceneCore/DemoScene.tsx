// DemoScene.tsx
import React, { useEffect } from "react";
import { Canvas } from "@react-three/fiber";

import { useBreakpoint } from "./Utilities/Breakpoints";
import { CameraSwitcher } from "./Cameras/CameraSwitcher";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";
import { useSceneStore } from "./Store/SceneStore";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 720, height: 1920 },
  tablet: { width: 1280, height: 1280 },
  desktop: { width: 1920, height: 720 },
};

export function DemoScene() {
  const breakpoint = useBreakpoint();
  const setSceneSize = useSceneStore((s) => s.setSceneSize);

  // 💡 Update SceneStore when breakpoint changes
  useEffect(() => {
    const preset = backdropSizes[breakpoint] ?? backdropSizes.desktop;
    setSceneSize(preset.width, preset.height);
  }, [breakpoint, setSceneSize]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas>
        <CameraSwitcher />

        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 300, 400]} intensity={1} castShadow />

        {/* Backdrop now reads directly from store */}
        <Backdrop color="#dc4c4c" />
      </Canvas>
    </div>
  );
}
