// ImagePlane.tsx
import React, { forwardRef, useMemo, useRef } from "react";
import * as THREE from "three";

import { FakeShadowReceiver } from "./FakeShadowReceiver";
import { FakeShadowCaster } from "./FakeShadowCaster";

export interface ImagePlaneProps {
  id: string;

  /**
   * PNG with alpha channel used both for visible image
   * and for shadow masking.
   */
  src?: string;

  color?: string;

  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  lightRef: React.RefObject<THREE.DirectionalLight>;

  /** Cast shadows? */
  castsShadow?: boolean;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  function ImagePlane(
    {
      id,
      src,
      color = "#ffffff",
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      lightRef,
      castsShadow = true,
    },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh>(null!);

    // Load PNG with alpha
    const texture = useMemo(() => {
      if (!src) return null;
      const loader = new THREE.TextureLoader();
      const tex = loader.load(src);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }, [src]);

    return (
      <>
        {/* The visible object */}
        <mesh
          ref={(m) => {
            meshRef.current = m!;
            if (typeof ref === "function") ref(m!);
            else if (ref) (ref as any).current = m;
          }}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={texture || undefined}
            color={texture ? undefined : color}
            transparent={!!texture}
            alphaTest={0.5} // ← CRITICAL FIX
          />
        </mesh>

        {/* Register shadow receiver with mask */}
        <FakeShadowReceiver id={id} meshRef={meshRef} alphaMap={texture} />

        {/* Register caster if desired */}
        {castsShadow && (
          <FakeShadowCaster
            id={id}
            targetRef={meshRef}
            lightRef={lightRef}
            alphaMap={texture}
          />
        )}
      </>
    );
  }
);
