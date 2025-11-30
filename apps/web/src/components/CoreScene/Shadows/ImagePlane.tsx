// ImagePlane.tsx
import React, { forwardRef, useRef } from "react";
import * as THREE from "three";
import { FakeShadowCaster } from "./FakeShadowCaster";

export interface ImagePlaneProps {
  id: string;
  color?: string;
  position?: [number, number, number];
  lightRef: React.RefObject<THREE.DirectionalLight>;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  function ImagePlane(
    { id, color = "#ffffff", position = [0, 0, 0], lightRef },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh>(null!);

    return (
      <group>
        <mesh ref={meshRef} position={position}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>

        <FakeShadowCaster id={id} targetRef={meshRef} lightRef={lightRef} />
      </group>
    );
  }
);
