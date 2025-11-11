// @ts-nocheck

import { useEffect, useRef } from "react";
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
 * Uses ParallaxConfig.scene.background.{widthWorld,heightWorld,depth}
 * as defaults, reports actual geometry to ParallaxStore.
 */
export function BackgroundPlane({
  src,
  width = ParallaxConfig.scene.background.widthWorld,
  height = ParallaxConfig.scene.background.heightWorld,
  depth = ParallaxConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, src);

  const setBackgroundWidth = useParallaxStore((s) => s.setBackgroundWidth);
  const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);

  // Maintain correct aspect if height not provided
  const aspect =
    texture?.image && texture.image.width && texture.image.height
      ? texture.image.width / texture.image.height
      : 1;
  const planeWidth = width ?? ParallaxConfig.scene.background.widthWorld;
  const planeHeight =
    height ??
    ParallaxConfig.scene.background.heightWorld ??
    planeWidth / aspect;

  useEffect(() => {
    setBackgroundWidth(planeWidth);
    setBackgroundHeight(planeHeight);
  }, [planeWidth, planeHeight, setBackgroundWidth, setBackgroundHeight]);

  useEffect(() => {
    console.log(
      "📏 BackgroundPlane mounted:",
      "width =",
      planeWidth.toFixed(3),
      "height =",
      planeHeight.toFixed(3)
    );
    setBackgroundWidth(planeWidth);
    setBackgroundHeight(planeHeight);
  }, [planeWidth, planeHeight, setBackgroundWidth, setBackgroundHeight]);

  return (
    <ParallaxGroup depth={depth}>
      <mesh ref={meshRef} position={[0, 0, 0]}>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </ParallaxGroup>
  );
}
