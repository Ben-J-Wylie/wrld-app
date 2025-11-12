import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useSceneStore } from "../SceneStore";
import { Group } from "./Group";
import { SceneConfig } from "../SceneConfig";

/**
 * BackgroundPlane
 * ---------------------------------------------------------------------------
 * Base background geometry that defines world width/height for scene fitting.
 * Reports its dimensions to SceneStore for camera FOV and scroll scaling.
 */
interface BackgroundPlaneProps {
  src: string;
  width?: number;
  height?: number;
  depth?: number;
}

export function BackgroundPlane({
  src,
  width = SceneConfig.scene.background.widthWorld,
  height = SceneConfig.scene.background.heightWorld,
  depth = SceneConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useLoader(THREE.TextureLoader, src);

  const setWorldWidth = useSceneStore((s) => s.setWorldWidth);
  const setWorldHeight = useSceneStore((s) => s.setWorldHeight);

  const aspect =
    texture?.image && texture.image.width && texture.image.height
      ? texture.image.width / texture.image.height
      : 1;

  const planeWidth = width ?? SceneConfig.scene.background.widthWorld;
  const planeHeight =
    height ?? SceneConfig.scene.background.heightWorld ?? planeWidth / aspect;

  useEffect(() => {
    setWorldWidth(planeWidth);
    setWorldHeight(planeHeight);
  }, [planeWidth, planeHeight, setWorldWidth, setWorldHeight]);

  useEffect(() => {
    console.log(
      "📏 BackgroundPlane mounted:",
      "width =",
      planeWidth.toFixed(3),
      "height =",
      planeHeight.toFixed(3)
    );
  }, [planeWidth, planeHeight]);

  return (
    <Group depth={depth}>
      <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[planeWidth, planeHeight]} />
        <meshStandardMaterial
          map={texture}
          toneMapped
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide}
          shadowSide={THREE.FrontSide}
        />
      </mesh>
    </Group>
  );
}
