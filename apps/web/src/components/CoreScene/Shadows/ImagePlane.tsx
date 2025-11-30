// ImagePlane.tsx
import React, { forwardRef, useRef, useMemo, useLayoutEffect } from "react";
import * as THREE from "three";
import { FakeShadowCaster } from "./FakeShadowCaster";
import { FakeShadowReceiver } from "./FakeShadowReceiver";

export interface ImagePlaneProps {
  id: string;
  src?: string;
  color?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  lightRef: React.RefObject<THREE.DirectionalLight>;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  function ImagePlane(
    {
      id,
      src,
      color = "#ffffff",
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      lightRef,
    },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh>(null!);

    // Load silhouette texture (PNG with alpha)
    const texture = useMemo(() => {
      if (!src) return null;
      const loader = new THREE.TextureLoader();
      const tex = loader.load(src);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    }, [src]);

    // -----------------------------------------
    // WORLD-Z BASED GEOMETRY RENDER ORDER
    // -----------------------------------------
    useLayoutEffect(() => {
      if (!meshRef.current) return;

      const obj = meshRef.current;
      const wp = new THREE.Vector3();

      // Compute once at mount (static objects)
      obj.getWorldPosition(wp);

      // Geometry gets even renderOrder
      obj.renderOrder = wp.z * 2;
    }, [position]);

    return (
      <group>
        {/* Visible Image Plane */}
        <mesh ref={meshRef} position={position} rotation={rotation}>
          <planeGeometry args={[1, 1]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              transparent={true}
              depthWrite={false} // <-- REQUIRED for transparency to work properly
              depthTest={true} // <-- Keep so geometry in front occludes correctly
              color={color}
            />
          ) : (
            <meshStandardMaterial color={color} />
          )}
        </mesh>

        {/* Shadow Receiver */}
        <FakeShadowReceiver id={id} meshRef={meshRef} />

        {/* Shadow Caster (silhouette shadow) */}
        <FakeShadowCaster
          id={id}
          targetRef={meshRef}
          lightRef={lightRef}
          alphaMap={texture || undefined}
        />
      </group>
    );
  }
);
