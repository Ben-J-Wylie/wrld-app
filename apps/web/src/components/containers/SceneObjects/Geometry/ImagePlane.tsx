// SceneCore/Layers/ImagePlane.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createImagePlane } from "./ImagePlanePrimitive";
import { useStage } from "../../SceneCore/Stage/useStage";
import { useParent } from "../../SceneCore/Utilities/ParentContext";
import { getBreakpoint } from "../../SceneCore/Theme/Breakpoints";
import { resolveResponsive } from "../../SceneCore/Utilities/ResponsiveResolve";
import type { BreakpointKey } from "../../SceneCore/Utilities/ResponsiveResolve";

import { DomSurface, DomSurfaceAPI } from "../../SceneCore/Layers/DomSurface"; // ⭐ You will adjust this import path

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

export interface ImagePlaneProps {
  /** Direct Texture override (useful for CanvasTexture, DomSurface, etc.) */
  texture?: THREE.Texture;

  /** Normal file texture */
  src?: string;
  color?: string | number;

  /** DOM Content → CanvasTexture → ImagePlane */
  domContent?: React.ReactNode;
  domBackground?: string;
  domPixelScale?: number;

  width?: number | ResponsiveNumber;
  height?: number | ResponsiveNumber;

  position?: [number, number, number] | ResponsiveVec3;
  rotation?: [number, number, number] | ResponsiveVec3;
  scale?: [number, number, number] | ResponsiveVec3;

  z?: number;
  visible?: boolean;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
  onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
}

export function ImagePlane(props: ImagePlaneProps) {
  const {
    texture,
    src,
    color,

    domContent,
    domBackground = "transparent",
    domPixelScale = 0.01,

    width,
    height,

    position,
    rotation,
    scale,

    z = 0,
    visible = true,

    castShadow,
    receiveShadow,

    onClick,
    onHover,
  } = props;

  const stage = useStage();
  const parent = useParent() ?? null;
  const meshRef = useRef<THREE.Mesh | null>(null);

  // For DOM textures we need to store the surface
  const [domSurface, setDomSurface] = useState<DomSurfaceAPI | null>(null);

  const bp = getBreakpoint(window.innerWidth) as BreakpointKey;

  const w = resolveResponsive<number>(width, bp, 100);
  const h = resolveResponsive<number>(height, bp, 100);

  const pos = resolveResponsive<[number, number, number]>(
    position,
    bp,
    [0, 0, 0]
  );

  const rot = resolveResponsive<[number, number, number]>(
    rotation,
    bp,
    [0, 0, 0]
  );

  const scl = resolveResponsive<[number, number, number]>(scale, bp, [1, 1, 1]);

  // -------------------------------------------------------------------------
  // MESH INIT
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mesh = createImagePlane({
      src,
      color,
      castShadow,
      receiveShadow,

      // --- Texture routing ---
      domSurface: domSurface
        ? {
            texture: domSurface.texture,
            width: domSurface.width,
            height: domSurface.height,
          }
        : null,
      useDomSurface: !!domContent,
      domPixelScale,
    });

    meshRef.current = mesh;

    // Set initial transforms
    mesh.scale.set(w * scl[0], h * scl[1], scl[2]);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.visible = visible;

    stage.addObject(mesh, parent);

    // Interaction
    if (onClick || onHover) {
      stage.registerInteractive(mesh, { onClick, onHover });
    }

    return () => {
      if (!meshRef.current) return;

      const m = meshRef.current;
      if (onClick || onHover) stage.unregisterInteractive(m);

      stage.removeObject(m);

      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    };
  }, [
    src,
    color,
    domContent,
    domSurface,
    domPixelScale,
    castShadow,
    receiveShadow,
    stage,
    parent,
    onClick,
    onHover,
  ]);

  // -------------------------------------------------------------------------
  // TRANSFORM UPDATES
  // -------------------------------------------------------------------------
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.scale.set(w * scl[0], h * scl[1], scl[2]);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.visible = visible;
  });

  // -------------------------------------------------------------------------
  // DOM SURFACE WRAPPER (offscreen)
  // -------------------------------------------------------------------------
  // DomSurface must exist in React tree for ImagePlane to receive updates
  return domContent ? (
    <>
      <DomSurface
        content={domContent}
        background={domBackground}
        pixelRatio={window.devicePixelRatio}
        onReady={(api) => {
          setDomSurface(api);
          api.update(); // trigger first refresh
        }}
      />
      {/* Plane itself does not render anything directly */}
    </>
  ) : null;
}
