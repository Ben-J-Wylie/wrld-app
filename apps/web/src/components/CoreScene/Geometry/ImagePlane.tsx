// CoreScene/Geometry/ImagePlane.tsx
import * as THREE from "three";
import React, { forwardRef, useEffect, useMemo, useState, useRef } from "react";

import { TextureLoader } from "three";
import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver";

import { createRoundedRectangleShape } from "./RoundedRectangle";

type Vec3 = [number, number, number];

// --------------------------------------------------
// Degrees → radians
// --------------------------------------------------
function degVec3(v: Vec3): Vec3 {
  return [
    THREE.MathUtils.degToRad(v[0]),
    THREE.MathUtils.degToRad(v[1]),
    THREE.MathUtils.degToRad(v[2]),
  ];
}

export interface ImagePlaneProps {
  name?: string;

  src?: string | null;
  texture?: THREE.Texture;
  color?: THREE.ColorRepresentation;

  width?: ResponsiveValue<number>;
  height?: ResponsiveValue<number>;
  cornerRadius?: ResponsiveValue<number>;

  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  z?: number;
  visible?: boolean;

  // Real shadows
  castShadow?: boolean;
  receiveShadow?: boolean;

  // Pointer events
  onClick?: (e: THREE.Event, hit: THREE.Intersection) => void;
  onHover?: (e: THREE.Event | null, hit: THREE.Intersection | null) => void;
  onPointerDown?: (e: any) => void;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  (
    {
      name,

      src = null,
      texture,
      color = "#ffffff",

      width = 100,
      height = 100,
      cornerRadius = 0,

      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],

      z = 0,
      visible = true,

      castShadow = false,
      receiveShadow = false,

      onClick,
      onHover,
      onPointerDown,
    },
    forwardedRef
  ) => {
    const bp = useSceneStore((s) => s.breakpoint);

    const groupRef = useRef<THREE.Group>(null!);
    const localMeshRef = useRef<THREE.Mesh>(null!);
    const meshRef =
      (forwardedRef as React.RefObject<THREE.Mesh>) ?? localMeshRef;

    // --------------------------------------------------
    // Load image texture
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
    const resolvedRadius = resolveResponsive(cornerRadius, bp);

    const resolvedPosition = resolveResponsive(position, bp) as Vec3;

    const rotationDeg = resolveResponsive(rotation, bp) as Vec3;
    const resolvedRotation = degVec3(rotationDeg);

    const resolvedScale = resolveResponsive(scale, bp) as Vec3;

    // --------------------------------------------------
    // Geometry
    // --------------------------------------------------
    const geometry = useMemo(() => {
      const w = resolvedWidth;
      const h = resolvedHeight;
      const r = resolvedRadius ?? 0;

      if (r <= 0.0001) {
        return new THREE.PlaneGeometry(w, h);
      }

      const shape = createRoundedRectangleShape(w, h, r);
      const geo = new THREE.ShapeGeometry(shape);

      // Recalculate UVs
      geo.computeBoundingBox();
      const bbox = geo.boundingBox!;
      const size = new THREE.Vector2(
        bbox.max.x - bbox.min.x,
        bbox.max.y - bbox.min.y
      );

      const uvAttr = geo.getAttribute("uv");
      for (let i = 0; i < uvAttr.count; i++) {
        const x = geo.attributes.position.getX(i) - bbox.min.x;
        const y = geo.attributes.position.getY(i) - bbox.min.y;
        uvAttr.setXY(i, x / size.x, y / size.y);
      }

      return geo;
    }, [resolvedWidth, resolvedHeight, resolvedRadius]);

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
      <group
        ref={groupRef}
        name={name ?? ""}
        position={resolvedPosition}
        rotation={resolvedRotation}
        scale={resolvedScale}
        renderOrder={z ?? 0}
        visible={visible}
      >
        {/* ------------------------------------------------------------------
            Visible Plane (REAL shadow compatible)
           ------------------------------------------------------------------ */}
        <mesh
          ref={meshRef}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
          geometry={geometry}
          onClick={handleClick}
          onPointerDown={onPointerDown}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
        >
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
      </group>
    );
  }
);

ImagePlane.displayName = "ImagePlane";
