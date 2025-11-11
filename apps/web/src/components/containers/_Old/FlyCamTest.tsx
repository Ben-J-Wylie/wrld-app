import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useRef } from "react";

/**
 * FlyCamTest
 * Simple standalone sandbox for verifying camera and orbit behavior.
 */
function Scene() {
  const boxRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (boxRef.current) boxRef.current.rotation.y += 0.01;
  });

  return (
    <>
      <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={60} />
      <OrbitControls enableDamping dampingFactor={0.05} />
      <mesh ref={boxRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshNormalMaterial />
      </mesh>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} />
    </>
  );
}

export default function FlyCamTest() {
  return (
    <Canvas style={{ width: "100vw", height: "100vh" }}>
      <Scene />
    </Canvas>
  );
}
