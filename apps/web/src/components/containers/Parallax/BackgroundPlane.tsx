// src/parallax/BackgroundPlane.tsx
import { useEffect, useRef } from "react";
import { Mesh } from "three";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";

interface BackgroundPlaneProps {
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
}

export function BackgroundPlane({
  width = ParallaxConfig.scene.layerDefaults.width * 2.5,
  height = 20,
  depth = ParallaxConfig.scene.background.depth,
  color = "#222",
}: BackgroundPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);

  useEffect(() => {
    if (meshRef.current) {
      const worldHeight = height;
      setBackgroundHeight(worldHeight);
    }
  }, [height, setBackgroundHeight]);

  return (
    <ParallaxGroup depth={depth}>
      <mesh ref={meshRef}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </ParallaxGroup>
  );
}
