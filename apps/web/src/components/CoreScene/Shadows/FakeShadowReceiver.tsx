// FakeShadowReceiver.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FakeShadowContext } from "./FakeShadowContext";

export interface FakeShadowReceiverProps {
  id: string;
  meshRef: React.RefObject<THREE.Mesh>;
  alphaMap?: THREE.Texture | null;
}

export function FakeShadowReceiver({
  id,
  meshRef,
  alphaMap,
}: FakeShadowReceiverProps) {
  const { registerReceiver, unregisterReceiver } =
    React.useContext(FakeShadowContext);

  const canvasRef = useRef<THREE.Mesh>(null!);

  useEffect(() => {
    registerReceiver({
      id,
      meshRef,
      alphaMap: alphaMap || null,
      canvasRef,
    });
    return () => unregisterReceiver(id);
  }, [id, meshRef, alphaMap, registerReceiver, unregisterReceiver]);

  // Clone the receiver geometry once it exists
  useEffect(() => {
    const receiverMesh = meshRef.current;
    const canvasMesh = canvasRef.current;
    if (!receiverMesh || !canvasMesh) return;

    // Clone geometry (important!)
    canvasMesh.geometry = receiverMesh.geometry.clone();
  }, [meshRef]);

  // Sync transform
  useFrame(() => {
    const mesh = meshRef.current;
    const canvas = canvasRef.current;
    if (!mesh || !canvas) return;

    mesh.updateWorldMatrix(true, false);

    // Copy world pos
    canvas.position.setFromMatrixPosition(mesh.matrixWorld);

    // Copy rotation
    canvas.quaternion.setFromRotationMatrix(mesh.matrixWorld);

    // Copy scale
    canvas.scale.copy(mesh.scale);

    // Slight offset along normal
    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(canvas.quaternion)
      .multiplyScalar(0.002);

    canvas.position.add(normal);
  });

  return (
    <mesh ref={canvasRef}>
      <meshBasicMaterial
        color="hotpink"
        opacity={0.3}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
