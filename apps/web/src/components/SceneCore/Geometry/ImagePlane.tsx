import * as THREE from "three";
import React, { forwardRef, useEffect, useMemo, useState } from "react";
import { TextureLoader } from "three";
import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver";

type Vec3 = [number, number, number];

// --------------------------------------------------
// Convert degrees → radians
// --------------------------------------------------
function degVec3(v: Vec3): Vec3 {
  return [
    THREE.MathUtils.degToRad(v[0]),
    THREE.MathUtils.degToRad(v[1]),
    THREE.MathUtils.degToRad(v[2]),
  ];
}

export interface ImagePlaneProps {
  src?: string | null;
  texture?: THREE.Texture;
  color?: THREE.ColorRepresentation;

  width?: ResponsiveValue<number>;
  height?: ResponsiveValue<number>;

  // These remain in DEGREES
  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  // ❗ z is now ONLY for renderOrder
  z?: number;

  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: THREE.Event, hit: THREE.Intersection) => void;
  onHover?: (e: THREE.Event | null, hit: THREE.Intersection | null) => void;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  (
    {
      src = null,
      texture,
      color = "#ffffff",

      width = 100,
      height = 100,

      position = [0, 0, 0],
      rotation = [0, 0, 0], // DEGREES
      scale = [1, 1, 1],

      z = 0, // renderOrder only
      visible = true,

      castShadow = true,
      receiveShadow = true,

      onClick,
      onHover,
    },
    ref
  ) => {
    const bp = useSceneStore((s) => s.breakpoint);

    // --------------------------------------------------
    // Load texture
    // --------------------------------------------------
    const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(
      null
    );

    useEffect(() => {
      if (!src) {
        setLoadedTexture(null);
        return;
      }

      let mounted = true;

      new TextureLoader().load(
        src,
        (tex) => {
          if (!mounted) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setLoadedTexture(tex);
        },
        undefined,
        (err) => {
          if (!mounted) return;
          console.warn("ImagePlane failed to load:", src, err);
          setLoadedTexture(null);
        }
      );

      return () => {
        mounted = false;
      };
    }, [src]);

    const finalTexture = texture ?? loadedTexture ?? null;

    // --------------------------------------------------
    // Responsive values
    // --------------------------------------------------
    const resolvedWidth = resolveResponsive(width, bp);
    const resolvedHeight = resolveResponsive(height, bp);

    const resolvedPosition = resolveResponsive(position, bp) as Vec3;
    const rotationDeg = resolveResponsive(rotation, bp) as Vec3;
    const resolvedRotation = degVec3(rotationDeg);
    const resolvedScale = resolveResponsive(scale, bp) as Vec3;

    // --------------------------------------------------
    // Pointer handlers
    // --------------------------------------------------
    const handlePointerMove = (e: any) => {
      if (!onHover) return;
      const hit = e.intersections?.[0] ?? null;
      onHover(e, hit);
    };

    const handlePointerOut = (e: any) => {
      if (onHover) onHover(e, null);
    };

    const handleClick = (e: any) => {
      if (!onClick) return;
      const hit = e.intersections?.[0] ?? null;
      onClick(e, hit);
    };

    // --------------------------------------------------
    // Render
    // --------------------------------------------------
    return (
      <mesh
        ref={ref}
        position={resolvedPosition} // ← TRUE 3D Z COMES FROM HERE
        rotation={resolvedRotation} // radians
        scale={resolvedScale}
        visible={visible}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        renderOrder={z ?? 0} // ← LAYERING ONLY
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[resolvedWidth, resolvedHeight]} />

        <meshStandardMaterial
          map={finalTexture ?? undefined}
          color={color}
          alphaTest={0.3}
          transparent={false}
          depthWrite={true}
          depthTest={true}
          toneMapped={true}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }
);

ImagePlane.displayName = "ImagePlane";
