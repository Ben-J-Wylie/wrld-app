// @ts-nocheck

import React from "react";
import { Canvas } from "@react-three/fiber";
import { ScrollControls } from "@react-three/drei";
import * as THREE from "three";

import Scene from "./components/containers/3D/Scene";
import Cameras from "./components/containers/3D/Cameras";

export default function App() {
  return (
    <div style={{ height: "100dvh", width: "100vw", background: "#0e0e0e" }}>
      <Canvas
        shadows
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.setClearColor("#000");
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.VSMShadowMap; // ✅ variance shadows for soft blur
        }}
      >
        <Cameras />
        <ScrollControls pages={2} damping={5}>
          <Scene />
        </ScrollControls>
      </Canvas>
    </div>
  );
}
