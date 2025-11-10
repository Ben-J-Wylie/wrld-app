// src/parallax/BackgroundPlane.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Mesh, TextureLoader } from "three";
import { useLoader, useThree } from "@react-three/fiber";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";

interface BackgroundPlaneProps {
  src: string;
  depth?: number;
}

/**
 * BackgroundPlane
 * ------------------------------------------------------------
 * - Fills the viewport horizontally.
 * - Preserves image aspect ratio for height.
 * - Reports its computed world height to ParallaxStore.
 */
export function BackgroundPlane({
  src,
  depth = ParallaxConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, src);
  const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);
  const { size } = useThree();

  // 🧮 Image aspect ratio (width / height)
  const imageAspect =
    texture.image && texture.image.width && texture.image.height
      ? texture.image.width / texture.image.height
      : 1;

  // 🧮 Compute width and height to preserve aspect
  const { planeWidth, planeHeight } = useMemo(() => {
    const aspect = size.width / size.height;
    const vFov = (ParallaxConfig.camera.fov * Math.PI) / 180;
    const visibleHeight =
      2 * Math.tan(vFov / 2) * ParallaxConfig.camera.positionZ;
    const visibleWidth = visibleHeight * aspect;

    // width fills viewport, height preserves image aspect
    const width = visibleWidth;
    const height = width / imageAspect;
    return { planeWidth: width, planeHeight: height };
  }, [size.width, size.height, imageAspect]);

  // 🧭 Report computed height to store for camera calibration
  useEffect(() => {
    setBackgroundHeight(planeHeight);
  }, [planeHeight, setBackgroundHeight]);

  return (
    <ParallaxGroup depth={depth}>
      <mesh ref={meshRef}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </ParallaxGroup>
  );
}
