// src/components/containers/SceneCore/Layers/ScreenPin.tsx
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";

export interface ScreenPinProps {
  children?: React.ReactNode;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export function ScreenPin({
  children,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: ScreenPinProps) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(new THREE.Group());

  // Attach group to camera
  useEffect(() => {
    const g = groupRef.current;
    camera.add(g);

    return () => {
      camera.remove(g); // wrapped in block → no invalid return type
    };
  }, [camera]);

  // Apply local transforms
  useEffect(() => {
    const g = groupRef.current;
    g.position.set(position[0], position[1], position[2]);
    g.rotation.set(rotation[0], rotation[1], rotation[2]);
    g.scale.set(scale[0], scale[1], scale[2]);
    g.updateMatrixWorld(true);
  }, [position, rotation, scale]);

  return <primitive object={groupRef.current}>{children}</primitive>;
}
