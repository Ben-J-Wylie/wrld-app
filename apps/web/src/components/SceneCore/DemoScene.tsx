// src/components/SceneCore/DemoScene.tsx
import React from "react";
import { Canvas } from "@react-three/fiber";
import { Backdrop } from "./Layers/Backdrop";

export function DemoScene() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 0, 500], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[200, 300, 400]} intensity={0.8} />
        <Backdrop width={800} height={1200} color={"#980000"} />
      </Canvas>
    </div>
  );
}
