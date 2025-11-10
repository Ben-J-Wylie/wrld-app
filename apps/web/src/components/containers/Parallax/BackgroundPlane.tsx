// src/parallax/BackgroundPlane.tsx
import { useEffect, useMemo, useRef } from "react";
import { Mesh, TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";

interface BackgroundPlaneProps {
  src: string;
  width?: number;
  height?: number;
  depth?: number;
}

/**
 * BackgroundPlane
 * ------------------------------------------------------------
 * - Regular piece of geometry (not a special case).
 * - Defines composition width (drives camera FOV).
 * - Reports its width + height to ParallaxStore.
 */
export function BackgroundPlane({
  src,
  width = 10,
  height,
  depth = ParallaxConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, src);
  const setBackgroundWidth = useParallaxStore((s) => s.setBackgroundWidth);
  const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);

  // Preserve texture aspect ratio if no height provided
  const aspect =
    texture.image && texture.image.width && texture.image.height
      ? texture.image.width / texture.image.height
      : 1;
  const planeHeight = height ?? width / aspect;

  // Measure once and store in global state
  useEffect(() => {
    setBackgroundWidth(width);
    setBackgroundHeight(planeHeight);
  }, [width, planeHeight, setBackgroundWidth, setBackgroundHeight]);

  return (
    <ParallaxGroup depth={depth}>
      <mesh ref={meshRef}>
        <planeGeometry args={[width, planeHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </ParallaxGroup>
  );
}
