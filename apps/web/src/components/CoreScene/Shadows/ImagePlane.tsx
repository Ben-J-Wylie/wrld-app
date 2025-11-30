// ImagePlane.tsx
import React, { forwardRef, useRef } from "react";
import * as THREE from "three";
import { FakeShadowCaster } from "./FakeShadowCaster";
import { FakeShadowReceiver } from "./FakeShadowReceiver";

export interface ImagePlaneProps {
  id: string;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  lightRef: React.RefObject<THREE.DirectionalLight>;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  function ImagePlane(
    {
      id,
      color = "#ffffff",
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      lightRef,
    },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh>(null!);

    // attach forwarded ref
    if (ref) {
      if (typeof ref === "function") ref(meshRef.current);
      else (ref as any).current = meshRef.current;
    }

    return (
      <group>
        <mesh ref={meshRef} position={position} rotation={rotation}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>

        <FakeShadowReceiver id={id} meshRef={meshRef} />
        <FakeShadowCaster id={id} targetRef={meshRef} lightRef={lightRef} />
      </group>
    );
  }
);
