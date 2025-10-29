// @ts-nocheck

import React from "react";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera, OrbitControls } from "@react-three/drei";
import Scene from "./components/containers/3D/Scene";
import * as THREE from "three";

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
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <PerspectiveCamera makeDefault position={[0, 2, 5]} fov={50} />
        <OrbitControls />
        <Scene />
      </Canvas>
    </div>
  );
}
