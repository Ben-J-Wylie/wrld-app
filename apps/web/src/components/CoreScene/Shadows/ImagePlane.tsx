// ImagePlane.tsx
import React, { forwardRef, useMemo, useRef } from "react";
import * as THREE from "three";

import { FakeShadowReceiver } from "./FakeShadowReceiver";
import { FakeShadowCaster } from "./FakeShadowCaster";
// import { opaqueWhiteTex } from "./utilOpaqueWhiteTex";

// -------------------------
// Procedural rounded-rect alpha generator
// -------------------------
function makeProceduralAlphaMask(radius = 0, edgeErode = 0, resolution = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = resolution;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, resolution, resolution);

  const inset = edgeErode * resolution;
  const r = radius * resolution * 0.5;
  const rr = Math.max(0, r - inset);

  const left = inset;
  const right = resolution - inset;
  const top = inset;
  const bottom = resolution - inset;

  ctx.fillStyle = "white";
  ctx.beginPath();

  ctx.moveTo(left + rr, top);
  ctx.lineTo(right - rr, top);
  ctx.quadraticCurveTo(right, top, right, top + rr);

  ctx.lineTo(right, bottom - rr);
  ctx.quadraticCurveTo(right, bottom, right - rr, bottom);

  ctx.lineTo(left + rr, bottom);
  ctx.quadraticCurveTo(left, bottom, left, bottom - rr);

  ctx.lineTo(left, top + rr);
  ctx.quadraticCurveTo(left, top, left + rr, top);

  ctx.closePath();
  ctx.fill();

  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  return texture;
}

// -------------------------

export interface ImagePlaneProps {
  id: string;
  src?: string;
  color?: string;

  cornerRadius?: number; // 0–0.5
  edgeErode?: number; // 0–0.2
  useProceduralMask?: boolean;

  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  lightRef: React.RefObject<THREE.DirectionalLight>;
  castsShadow?: boolean;
}

export const ImagePlane = forwardRef<THREE.Mesh, ImagePlaneProps>(
  function ImagePlane(
    {
      id,
      src,
      color = "#ffffff",
      cornerRadius = 0.0,
      edgeErode = 0.0,
      useProceduralMask = false,
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],
      lightRef,
      castsShadow = true,
    },
    ref
  ) {
    const meshRef = useRef<THREE.Mesh>(null!);

    // PNG
    const pngTexture = useMemo(() => {
      if (!src) return null;
      const loader = new THREE.TextureLoader();
      const tex = loader.load(src);
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      return tex;
    }, [src]);

    // Procedural mask
    const proceduralMask = useMemo(() => {
      if (src && !useProceduralMask) return null;
      return makeProceduralAlphaMask(cornerRadius, edgeErode, 512);
    }, [src, cornerRadius, edgeErode, useProceduralMask]);

    const effectiveMask = pngTexture || proceduralMask;
    const effectiveCasterMask = pngTexture || proceduralMask || null;

    return (
      <>
        {/* VISIBLE PLANE */}
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
            map={pngTexture || undefined}
            color={pngTexture ? undefined : color}
            transparent={false}
            alphaMap={!pngTexture ? effectiveMask : null} // ⬅️ only for procedural masks
            alphaTest={1}
          />
        </mesh>

        {/* RECEIVER: CLIPS SHADOWS USING PNG OR PROCEDURAL MASK */}
        <FakeShadowReceiver
          id={id}
          meshRef={meshRef}
          alphaMap={effectiveMask}
        />

        {/* CASTER: USES SAME SILHOUETTE */}
        {castsShadow && (
          <FakeShadowCaster
            id={id}
            targetRef={meshRef}
            lightRef={lightRef}
            alphaMap={effectiveCasterMask}
          />
        )}
      </>
    );
  }
);
