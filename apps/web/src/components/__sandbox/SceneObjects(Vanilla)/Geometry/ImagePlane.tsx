// ImagePlane.tsx
import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { useBreakpoint } from "../../../CoreScene/Utilities/Breakpoints";

// --------------------------------------------------
// Breakpoint type
// --------------------------------------------------
type BP = "mobile" | "tablet" | "desktop";

// --------------------------------------------------
// Responsive types
// --------------------------------------------------
interface ResponsiveNumber {
  mobile?: number;
  tablet?: number;
  desktop?: number;
}

interface ResponsiveVec3 {
  mobile?: [number, number, number];
  tablet?: [number, number, number];
  desktop?: [number, number, number];
}

// --------------------------------------------------
// Component props
// --------------------------------------------------
interface ImagePlaneProps {
  // Texture + color
  src?: string;
  texture?: THREE.Texture;
  color?: THREE.ColorRepresentation;

  // Responsive geometry
  width?: number | ResponsiveNumber;
  height?: number | ResponsiveNumber;

  position?: [number, number, number] | ResponsiveVec3;
  rotation?: [number, number, number] | ResponsiveVec3;
  scale?: [number, number, number] | ResponsiveVec3;

  // Single values
  z?: number;
  visible?: boolean;

  // Shadows
  castShadow?: boolean;
  receiveShadow?: boolean;

  // Interaction
  onClick?: (e: THREE.Event, hit: THREE.Intersection) => void;
  onHover?: (e: THREE.Event, hit: THREE.Intersection | null) => void;
}

// --------------------------------------------------
// Responsive resolve utilities
// --------------------------------------------------
function isResponsiveObject<T>(v: any): v is Partial<Record<BP, T>> {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    ("mobile" in v || "tablet" in v || "desktop" in v)
  );
}

function resolveResponsive<T>(value: T | Partial<Record<BP, T>>, bp: BP): T {
  if (value === undefined) return undefined as any;

  // Not responsive → return as-is
  if (!isResponsiveObject(value)) return value as T;

  // Value for this breakpoint?
  const bpValue = value[bp];
  if (bpValue !== undefined) return bpValue;

  // Fallback: first defined value
  for (const key of ["mobile", "tablet", "desktop"] as BP[]) {
    const v = value[key];
    if (v !== undefined) return v;
  }

  throw new Error("Responsive object has no values");
}

// --------------------------------------------------
// Component
// --------------------------------------------------
export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  (
    {
      src,
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
    const bp = useBreakpoint(); // mobile / tablet / desktop

    // -----------------------------
    // Texture loading (if src provided)
    // -----------------------------
    const loadedTexture =
      src !== undefined
        ? (useLoader(TextureLoader, src) as THREE.Texture)
        : undefined;

    const finalTexture = texture ?? loadedTexture ?? null;

    // -----------------------------
    // Resolve responsive props
    // -----------------------------
    const w = resolveResponsive(width, bp);
    const h = resolveResponsive(height, bp);

    const pos = resolveResponsive(position, bp);
    const rot = resolveResponsive(rotation, bp);
    const scl = resolveResponsive(scale, bp);

    // Inject Z override
    const finalPos = useMemo<[number, number, number]>(() => {
      const p = [...(pos as [number, number, number])];
      if (z !== undefined) p[2] = z;
      return p as [number, number, number];
    }, [pos, z]);

    // -----------------------------
    // Interactivity handlers
    // -----------------------------
    const handlePointerMove = (e: any) => {
      if (onHover) onHover(e, e.intersections?.[0] ?? null);
    };

    const handlePointerOut = (e: any) => {
      if (onHover) onHover(e, null);
    };

    const handleClick = (e: any) => {
      if (onClick) onClick(e, e.intersections?.[0]);
    };

    // -----------------------------
    // Render
    // -----------------------------
    return (
      <mesh
        ref={ref}
        position={finalPos}
        rotation={rot as any}
        scale={scl as any}
        visible={visible}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <planeGeometry args={[w, h]} />

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
