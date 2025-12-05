// apps/web/src/wrld/CoreScene/Geometry/VideoPlane.tsx

import * as THREE from "three";
import React, { forwardRef, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { useSceneStore } from "../Store/SceneStore";
import {
  resolveResponsive,
  ResponsiveValue,
} from "../Utilities/BreakpointResolver";

type Vec3 = [number, number, number];

function degVec3(v: Vec3): Vec3 {
  return [
    THREE.MathUtils.degToRad(v[0]),
    THREE.MathUtils.degToRad(v[1]),
    THREE.MathUtils.degToRad(v[2]),
  ];
}

export interface VideoPlaneProps {
  name?: string;
  texture?: THREE.Texture | null;

  width?: ResponsiveValue<number>;
  height?: ResponsiveValue<number>;

  position?: ResponsiveValue<Vec3>;
  rotation?: ResponsiveValue<Vec3>;
  scale?: ResponsiveValue<Vec3>;

  z?: number;
  visible?: boolean;
}

export const VideoPlane = forwardRef<THREE.Mesh, VideoPlaneProps>(
  (
    {
      name = "VideoPlane",
      texture,

      width = 320,
      height = 180,

      position,
      rotation,
      scale,

      z = 0,
      visible = true,
    },
    ref
  ) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const materialRef = useRef<THREE.MeshBasicMaterial>(null!);

    const setRefs = (node: THREE.Mesh | null) => {
      meshRef.current = node as any;
      if (typeof ref === "function") ref(node);
      else if (ref && "current" in ref) (ref as any).current = node;
    };

    const breakpoint = useSceneStore((s) => s.breakpoint);

    const defaultVec3: ResponsiveValue<Vec3> = {
      mobile: [0, 0, 0],
      tablet: [0, 0, 0],
      desktop: [0, 0, 0],
    };
    const defaultScale: ResponsiveValue<Vec3> = {
      mobile: [1, 1, 1],
      tablet: [1, 1, 1],
      desktop: [1, 1, 1],
    };

    const safePosition = position ?? defaultVec3;
    const safeRotation = rotation ?? defaultVec3;
    const safeScale = scale ?? defaultScale;

    const resolvedWidth = resolveResponsive(width, breakpoint) ?? 320;
    const resolvedHeight = resolveResponsive(height, breakpoint) ?? 180;

    const resolvedPosition = useMemo<Vec3>(() => {
      const base = resolveResponsive<Vec3>(safePosition, breakpoint);
      return [base[0], base[1], (base[2] ?? 0) + z];
    }, [safePosition, breakpoint, z]);

    const resolvedRotation = useMemo<Vec3>(() => {
      const v = resolveResponsive<Vec3>(safeRotation, breakpoint);
      return degVec3(v);
    }, [safeRotation, breakpoint]);

    const resolvedScale = useMemo<Vec3>(() => {
      return resolveResponsive<Vec3>(safeScale, breakpoint);
    }, [safeScale, breakpoint]);

    React.useEffect(() => {
      if (!materialRef.current) return;
      materialRef.current.map = texture ?? null;
      materialRef.current.needsUpdate = true;
    }, [texture]);

    useFrame(() => {
      if (texture && !(texture as any).__rvfcDriven) {
        texture.needsUpdate = true;
      }
    });

    return (
      <group
        name={name}
        position={resolvedPosition}
        rotation={resolvedRotation}
        scale={resolvedScale}
        visible={visible}
      >
        <mesh ref={setRefs}>
          <planeGeometry args={[resolvedWidth, resolvedHeight]} />

          {/* basic material: no lighting, no tone mapping, fastest possible */}
          <meshBasicMaterial ref={materialRef} toneMapped={false} />
        </mesh>
      </group>
    );
  }
);
