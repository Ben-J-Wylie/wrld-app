// ImagePlane.tsx
import * as THREE from "three";
import React, { forwardRef } from "react";

interface ImagePlaneProps {
  texture: THREE.Texture;
  width: number;
  height: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  (
    { texture, width, height, position = [0, 0, 0], rotation = [0, 0, 0] },
    ref
  ) => {
    return (
      <mesh
        ref={ref}
        position={position}
        rotation={rotation}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[width, height]} />

        <meshStandardMaterial
          map={texture}
          alphaTest={0.3} // ❗ required for shadow casting on PNGs
          transparent={false} // keep shadows working
          depthWrite={true} // must be true for shadow casting
          depthTest={true}
          toneMapped={true}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }
);

ImagePlane.displayName = "ImagePlane";
