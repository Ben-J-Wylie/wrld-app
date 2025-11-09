import React, { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import { useParallaxScene } from "./ParallaxScene";
import { useResponsiveContext } from "../Responsive/ResponsiveContext";
import * as THREE from "three";
import type { GlShader, ObjectFit } from "../FeatureLayer/FeatureLayer";

type Props = {
  id: string;
  textureSrc: string;
  width: number;
  height: number;
  depth: number;
  hoverDepthShift: number;
  hovered: boolean;
  offsetX: number;
  offsetY: number;
  rotation: number; // degrees
  opacity: number;
  scale: number;
  fit: ObjectFit;
  shader: GlShader;
};

export function GLPlaneLayer({
  textureSrc,
  width,
  height,
  depth,
  hoverDepthShift,
  hovered,
  offsetX,
  offsetY,
  rotation,
  opacity,
  scale,
  fit,
  shader,
}: Props) {
  const map = useTexture(textureSrc);
  const { parallaxStrength } = useResponsiveContext();
  const { vw, vh } = useParallaxScene();

  // depth behavior matches your ParallaxItem “feel”
  const effectiveDepth = hovered
    ? depth + hoverDepthShift
    : depth * parallaxStrength;

  // Pixel sizes (orthographic, so these are world units == pixels)
  const targetW = (width ?? 0) * (scale ?? 1);
  const targetH = (height ?? 0) * (scale ?? 1);

  // If the texture has an intrinsic aspect, compute contain/cover fit
  const fitted = useMemo(() => {
    const imgW = map.image?.width ?? targetW;
    const imgH = map.image?.height ?? targetH;
    const imgAR = imgW / Math.max(1, imgH);
    const boxAR = targetW / Math.max(1, targetH);

    if (fit === "cover") {
      if (imgAR > boxAR) {
        // image wider → scale by height
        const h = targetH;
        const w = h * imgAR;
        return { w, h };
      } else {
        // image taller → scale by width
        const w = targetW;
        const h = w / imgAR;
        return { w, h };
      }
    } else {
      // contain
      if (imgAR > boxAR) {
        const w = targetW;
        const h = w / imgAR;
        return { w, h };
      } else {
        const h = targetH;
        const w = h * imgAR;
        return { w, h };
      }
    }
  }, [map.image, targetW, targetH, fit]);

  const tx = offsetX ?? 0;
  const ty = offsetY ?? 0;
  const rotationRad = ((rotation ?? 0) * Math.PI) / 180;

  const material = useMemo(() => {
    const common = { transparent: true, opacity, depthWrite: false } as const;
    switch (shader) {
      case "lambert":
        return <meshLambertMaterial map={map} {...common} />;
      case "unlit":
        // Unlit == Basic but ignore fog/lights intentionally
        return <meshBasicMaterial map={map} {...common} />;
      case "basic":
      default:
        return <meshBasicMaterial map={map} {...common} />;
    }
  }, [map, opacity, shader]);

  // Slight Z push to keep painter’s order stable
  const z = -effectiveDepth * 10;

  // Center the plane in its box
  return (
    <group position={[tx, -ty, z]} rotation={[0, 0, rotationRad]}>
      <mesh>
        <planeGeometry args={[fitted.w, fitted.h]} />
        {material}
      </mesh>
    </group>
  );
}
