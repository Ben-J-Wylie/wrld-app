// DemoScene.tsx
import React, { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { FakeShadowProvider } from "./FakeShadowContext";
import { FakeShadowReceiver } from "./FakeShadowReceiver";
import { ImagePlane } from "./ImagePlane";

export function DemoScene() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const backdropRef = useRef<THREE.Mesh>(null!);

  return (
    <Canvas shadows={false} camera={{ position: [0, 0, 5], fov: 45 }}>
      <color attach="background" args={["#ddd"]} />
      <OrbitControls />

      <FakeShadowProvider>
        {/* Directional Light */}
        <directionalLight
          ref={lightRef}
          position={[10, -10, 20]}
          intensity={1.5}
        />

        {/* Backdrop (also a receiver) */}
        <mesh ref={backdropRef} rotation={[0, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#fafafa" />
        </mesh>
        <FakeShadowReceiver id="backdrop" meshRef={backdropRef} />

        {/* Color-only planes (each caster+receiver) */}
        <ImagePlane
          id="one"
          color="#ff6666"
          position={[0, 2, 1]}
          lightRef={lightRef}
        />
        <ImagePlane
          id="two"
          color="#66ccff"
          position={[0.5, 2, 3]}
          lightRef={lightRef}
        />
        <ImagePlane
          id="four"
          color="#b41dff"
          position={[0.5, 2, 5]}
          lightRef={lightRef}
        />
        <ImagePlane
          id="three"
          color="#66ff99"
          position={[-0.3, 1.4, 1.5]}
          lightRef={lightRef}
        />
      </FakeShadowProvider>
    </Canvas>
  );
}
