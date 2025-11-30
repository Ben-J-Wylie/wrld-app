// Backdrop.tsx
import React, { useContext, useEffect, useRef } from "react";
import * as THREE from "three";
import { FakeShadowContext } from "./FakeShadowContext";

export function Backdrop({
  id,
  width,
  height,
  position,
  color = "#fafafa",
}: {
  id: string;
  width: number;
  height: number;
  position: [number, number, number];
  color?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { registerReceiver, unregisterReceiver } =
    useContext(FakeShadowContext);

  useEffect(() => {
    registerReceiver({ id, meshRef, width, height });
    return () => unregisterReceiver(id);
  }, [id, registerReceiver, unregisterReceiver, width, height]);

  return (
    <mesh ref={meshRef} position={position}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
