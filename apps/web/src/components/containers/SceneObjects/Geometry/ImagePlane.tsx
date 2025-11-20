// src/components/containers/SceneCore/Layers/ImagePlane.tsx
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { createImagePlane } from "./ImagePlanePrimitive";
import { useStage } from "../../SceneCore/Stage/useStage";
import { useParent } from "../../SceneCore/Layers/ParentContext";
import { getBreakpoint } from "../../SceneCore/Theme/Breakpoints";

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
  src?: string;
  color?: string | number;

  width?: ResponsiveNumber;
  height?: ResponsiveNumber;

  position?: ResponsiveVec3;
  rotation?: ResponsiveVec3;

  z?: number;

  castShadow?: boolean;
  receiveShadow?: boolean;

  onClick?: (e: PointerEvent, hit: THREE.Intersection) => void;
  onHover?: (e: PointerEvent, hit: THREE.Intersection | undefined) => void;
}

// -------------------------------------------------------
// Breakpoint Hook
// -------------------------------------------------------
function useBreakpoint() {
  const [bp, setBp] = useState(getBreakpoint(window.innerWidth));

  useEffect(() => {
    console.log("[ImagePlane] BP init =", bp);
    const onResize = () => {
      const next = getBreakpoint(window.innerWidth);
      console.log("[ImagePlane] BP resize →", next);
      setBp(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------
export function ImagePlane(props: ImagePlaneProps) {
  console.log("[ImagePlane] render props =", props);

  const {
    src,
    color,
    width,
    height,
    position,
    rotation,
    z = 0,
    castShadow,
    receiveShadow,
    onClick,
    onHover,
  } = props;

  const bp = useBreakpoint();
  const stage = useStage();

  // For scene, Group, or ScreenGroup
  const parent = useParent() ?? null;

  const meshRef = useRef<THREE.Mesh | null>(null);

  const w = width?.[bp] ?? 1;
  const h = height?.[bp] ?? 1;

  const pos = position?.[bp] ?? [0, 0, 0];
  const rot = rotation?.[bp] ?? [0, 0, 0];

  console.log("[ImagePlane] resolved values", {
    bp,
    w,
    h,
    pos,
    rot,
    parent,
  });

  // -------------------------------------------------------
  // MOUNT: Create Mesh
  // -------------------------------------------------------
  useEffect(() => {
    console.log("[ImagePlane] MOUNT effect starting…");

    const mesh = createImagePlane({
      src,
      color,
      castShadow,
      receiveShadow,
    });

    console.log("[ImagePlane] Primitive mesh created:", mesh);

    meshRef.current = mesh;

    mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);

    console.log("[ImagePlane] Transforms applied:", {
      scale: mesh.scale,
      position: mesh.position,
      rotation: mesh.rotation,
      zAdded: z,
    });

    stage.addObject(mesh, parent);

    console.log("[ImagePlane] After stage.addObject:", {
      realParent: mesh.parent,
      expectedParent: parent,
    });

    if (onClick || onHover) {
      stage.registerInteractive(mesh, { onClick, onHover });
      console.log("[ImagePlane] Registered interactive handlers");
    }

    return () => {
      console.log("[ImagePlane] UNMOUNT cleanup");
      const m = meshRef.current;
      if (!m) return;

      if (onClick || onHover) stage.unregisterInteractive(m);

      stage.removeObject(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    };
  }, [src, color, castShadow, receiveShadow, parent, stage]);

  // -------------------------------------------------------
  // UPDATE transforms on breakpoint
  // -------------------------------------------------------
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    console.log("[ImagePlane] BP update transforms:", {
      w,
      h,
      pos,
      rot,
      z,
    });

    mesh.scale.set(w, h, 1);
    mesh.position.set(pos[0], pos[1], pos[2] + z);
    mesh.rotation.set(rot[0], rot[1], rot[2]);

    // Force update world matrix for debug
    mesh.updateWorldMatrix(true, true);
    console.log("[ImagePlane] world matrix after update:", mesh.matrixWorld);
  }, [bp, w, h, pos, rot, z]);

  return null;
}
