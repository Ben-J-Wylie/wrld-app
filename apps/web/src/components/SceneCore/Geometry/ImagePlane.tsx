// ImagePlane.tsx
import * as THREE from "three";
import React, { forwardRef, useEffect, useMemo, useState } from "react";
import { TextureLoader } from "three";
import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  mergeZ,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver"; // ✅ adjust path if needed

type Vec3 = [number, number, number];

export interface ImagePlaneProps {
  // Texture sources
  src?: string | null;
  texture?: THREE.Texture;
  color?: THREE.ColorRepresentation;

  // Responsive sizing
  width?: ResponsiveValue<number>;
  height?: ResponsiveValue<number>;

  // Responsive transforms
  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  // Optional z override (for layering)
  z?: number;

  // Visibility + shadows
  visible?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;

  // Interaction callbacks
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
      rotation = [0, 0, 0],
      scale = [1, 1, 1],

      z = 0,
      visible = true,

      castShadow = true,
      receiveShadow = true,

      onClick,
      onHover,
    },
    ref
  ) => {
    // --------------------------------------------------
    // Breakpoint from global SceneStore
    // --------------------------------------------------
    const bp = useSceneStore((s) => s.breakpoint);

    // --------------------------------------------------
    // Texture loading (hook-safe, src is optional)
    // --------------------------------------------------
    const [loadedTexture, setLoadedTexture] = useState<THREE.Texture | null>(
      null
    );

    useEffect(() => {
      // If no src, clear any previous texture
      if (!src) {
        setLoadedTexture(null);
        return;
      }

      let isMounted = true;
      const loader = new TextureLoader();

      loader.load(
        src,
        (tex) => {
          if (!isMounted) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          setLoadedTexture(tex);
        },
        undefined,
        (err) => {
          if (!isMounted) return;
          console.warn("ImagePlane failed to load:", src, err);
          setLoadedTexture(null);
        }
      );

      return () => {
        isMounted = false;
      };
    }, [src]);

    const finalTexture = texture ?? loadedTexture ?? null;

    // --------------------------------------------------
    // Responsive resolution
    // --------------------------------------------------
    const resolvedWidth = resolveResponsive(width, bp);
    const resolvedHeight = resolveResponsive(height, bp);

    const basePosition = resolveResponsive(position, bp) as Vec3;
    const resolvedRotation = resolveResponsive(rotation, bp) as Vec3;
    const resolvedScale = resolveResponsive(scale, bp) as Vec3;

    const finalPos = useMemo<Vec3>(() => {
      // Use mergeZ helper so z override is clean & consistent
      return mergeZ(basePosition, z);
    }, [basePosition, z]);

    // --------------------------------------------------
    // Pointer handlers
    // --------------------------------------------------
    const handlePointerMove = (e: any) => {
      if (!onHover) return;
      const hit = e.intersections?.[0] ?? null;
      onHover(e, hit);
    };

    const handlePointerOut = (e: any) => {
      if (!onHover) return;
      onHover(e, null);
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
        position={finalPos}
        rotation={resolvedRotation as any}
        scale={resolvedScale as any}
        visible={visible}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
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
