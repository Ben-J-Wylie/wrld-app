// ImagePlane.tsx
import React, { forwardRef, useRef } from "react";
import * as THREE from "three";
import { FakeShadowCaster } from "./FakeShadowCaster";
import { FakeShadowReceiver } from "./FakeShadowReceiver";

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

    // if parent passes a ref, point it at the mesh
    if (ref) {
      if (typeof ref === "function") {
        ref(meshRef.current);
      } else {
        // @ts-ignore – defensive
        ref.current = meshRef.current;
      }
    }

    return (
      <group>
        <mesh ref={meshRef} position={position}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} />
        </mesh>

        {/* This plane both RECEIVES and CASTS fake shadows */}
        <FakeShadowReceiver id={id} meshRef={meshRef} />
        <FakeShadowCaster id={id} targetRef={meshRef} lightRef={lightRef} />
      </group>
    );
  }
);
