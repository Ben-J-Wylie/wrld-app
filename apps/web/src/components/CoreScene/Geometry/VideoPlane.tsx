// VideoPlane.tsx
import * as THREE from "three";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver";

import { createRoundedRectangleShape } from "./RoundedRectangle";

type Vec3 = [number, number, number];

// Convert degrees → radians
function degVec3(v: Vec3): Vec3 {
  return [
    THREE.MathUtils.degToRad(v[0]),
    THREE.MathUtils.degToRad(v[1]),
    THREE.MathUtils.degToRad(v[2]),
  ];
}

export interface VideoPlaneProps {
  name?: string;

  /** Path to mp4/webm or external <video> element */
  src?: string | null;
  videoElement?: HTMLVideoElement | null;

  width?: ResponsiveValue<number>;
  height?: ResponsiveValue<number>;

  /** Rounded corners */
  cornerRadius?: ResponsiveValue<number>;

  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  z?: number; // renderOrder only
  visible?: boolean;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: THREE.Event, hit: THREE.Intersection) => void;
  onHover?: (e: THREE.Event | null, hit: THREE.Intersection | null) => void;

  onPointerDown?: (e: any) => void;
}

export const VideoPlane = forwardRef<THREE.Mesh, VideoPlaneProps>(
  (
    {
      name,

      src = null,
      videoElement = null,

      width = 100,
      height = 100,
      cornerRadius = 0,

      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = [1, 1, 1],

      z = 0,
      visible = true,

      castShadow = true,
      receiveShadow = true,

      onClick,
      onHover,
      onPointerDown,
    },
    ref
  ) => {
    const bp = useSceneStore((s) => s.breakpoint);

    // ------------------------------------------
    // Video element + VideoTexture creation
    // ------------------------------------------
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

    useEffect(() => {
      let mounted = true;

      // Use provided element or create one
      const vid =
        videoElement ??
        (() => {
          if (!src) return null;

          const el = document.createElement("video");
          el.src = src;

          el.crossOrigin = "anonymous";
          el.loop = true;
          el.muted = true;
          el.playsInline = true;
          el.autoplay = true;

          el.play().catch(() => {});

          return el;
        })();

      videoRef.current = vid;

      if (vid) {
        const tex = new THREE.VideoTexture(vid);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;

        if (mounted) setTexture(tex);
      }

      return () => {
        mounted = false;
      };
    }, [src, videoElement]);

    // ------------------------------------------
    // Responsive values
    // ------------------------------------------
    const resolvedWidth = resolveResponsive(width, bp);
    const resolvedHeight = resolveResponsive(height, bp);
    const resolvedRadius = resolveResponsive(cornerRadius, bp);

    const resolvedPosition = resolveResponsive(position, bp) as Vec3;
    const rotationDeg = resolveResponsive(rotation, bp) as Vec3;
    const resolvedRotation = degVec3(rotationDeg);
    const resolvedScale = resolveResponsive(scale, bp) as Vec3;

    // ------------------------------------------
    // Geometry (plane or rounded rectangle)
    // ------------------------------------------
    const geometry = useMemo(() => {
      const w = resolvedWidth;
      const h = resolvedHeight;
      const r = resolvedRadius ?? 0;

      if (r <= 0.0001) {
        return new THREE.PlaneGeometry(w, h);
      }

      const shape = createRoundedRectangleShape(w, h, r);
      const geo = new THREE.ShapeGeometry(shape);

      // Proper UV mapping
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

    // ------------------------------------------
    // Pointer handlers
    // ------------------------------------------
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

    // ------------------------------------------
    // Render
    // ------------------------------------------
    return (
      <mesh
        ref={ref}
        name={name ?? ""}
        position={resolvedPosition}
        rotation={resolvedRotation}
        scale={resolvedScale}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
        renderOrder={z ?? 0}
        visible={visible}
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        geometry={geometry}
      >
        <meshStandardMaterial
          map={texture ?? undefined}
          color={"#ffffff"}
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

VideoPlane.displayName = "VideoPlane";
