// DemoScene.tsx
import React, { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

import { FakeShadowProvider } from "./FakeShadowContext";
import { FakeShadowReceiver } from "./FakeShadowReceiver";
import { DebugRenderTargets } from "./DebugRenderTargets";
import { ImagePlane } from "./ImagePlane";

import shapePng from "./shape.png";

export function DemoScene() {
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const backdropRef = useRef<THREE.Mesh>(null!);

  return (
    <Canvas shadows={false} camera={{ position: [0, 0, 5], fov: 45 }}>
      <color attach="background" args={["#ddd"]} />
      <OrbitControls />

      <FakeShadowProvider>
        <DebugRenderTargets />
        {/* Directional Light */}
        <directionalLight
          ref={lightRef}
          position={[5, 0, 20]}
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
          src={shapePng} // ← PNG with transparency
          //   color="#ff6666" // optional tint
          position={[0, 2.2, 1]}
          rotation={[0, 0, 0]}
          lightRef={lightRef}
        />
        <ImagePlane
          id="two"
          src={shapePng} // ← PNG with transparency
          //   color="#66ccff"
          position={[-0.2, 1, 3]}
          rotation={[0, 0, 0]}
          lightRef={lightRef}
        />

        <ImagePlane
          id="three"
          src={shapePng} // ← PNG with transparency
          //   color="#66ff99"
          position={[-0.3, 1.4, 1.5]}
          rotation={[0, 0, 45]}
          lightRef={lightRef}
        />
        <ImagePlane
          id="four"
          color="#66ff99"
          position={[-0.4, 1, 2]}
          rotation={[0, 0, 45]}
          lightRef={lightRef}
          cornerRadius={0.25}
          edgeErode={0.1}
          useProceduralMask={true}
        />
        <ImagePlane
          id="five"
          src={shapePng} // ← PNG with transparency
          //   color="#66ff99"
          position={[-0.1, 1.4, 4]}
          rotation={[0, 0, 0]}
          lightRef={lightRef}
        />
      </FakeShadowProvider>
    </Canvas>
  );
}
