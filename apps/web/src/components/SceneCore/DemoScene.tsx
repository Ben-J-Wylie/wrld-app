// DemoScene.tsx
import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Backdrop, BackdropDimensions } from "./Layers/Backdrop";

const backdropSizes: BackdropDimensions = {
  mobile: { width: 100, height: 100 },
  tablet: { width: 200, height: 300 },
  desktop: { width: 300, height: 200 },
};

export function DemoScene() {
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">(
    "desktop"
  );

  // Simple live breakpoint detector
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      if (w >= 1024) setBreakpoint("desktop");
      else if (w >= 720) setBreakpoint("tablet");
      else setBreakpoint("mobile");
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
      <Canvas camera={{ position: [0, 0, 1000], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[200, 300, 400]} intensity={1} />

        <Backdrop presetSizes={backdropSizes} breakpoint={breakpoint} />
      </Canvas>
    </div>
  );
}
