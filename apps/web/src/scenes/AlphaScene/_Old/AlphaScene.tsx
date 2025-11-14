// src/scenes/AlphaScene/AlphaScene.tsx
import { useEffect } from "react";
import { useSceneStore } from "@/components/containers/SceneCore/SceneStore";
import {
  BackgroundPlane,
  Group,
} from "@/components/containers/SceneCore/Layers";
import {
  LayerMid2Shape,
  LayerMid1Shape,
  LayerFrontShape,
  UiGlassShape,
} from "./Shapes";
import * as THREE from "three";

/**
 * AlphaScene
 * ---------------------------------------------------------------------------
 * A blank, ready-to-build 2.5D scene.
 * - Sets per-scene scene width/height
 * - Adds basic per-scene lighting
 * - Includes a placeholder background + layer structure
 */

export function AlphaScene() {
  const setSceneHeight = useSceneStore((s) => s.setSceneHeight);
  const setSceneWidth = useSceneStore((s) => s.setSceneWidth);

  useEffect(() => {
    setSceneWidth(100);
    setSceneHeight(200);
  }, [setSceneWidth, setSceneHeight]);

  return (
    <>
      {/* 🖼 Scene layers */}
      <BackgroundPlane />

      <Group depth={5}>
        <LayerMid2Shape castShadow receiveShadow />
      </Group>
      <Group depth={10}>
        <LayerMid1Shape castShadow receiveShadow />
      </Group>
      <Group depth={15}>
        <LayerFrontShape castShadow receiveShadow />
      </Group>
      <Group depth={20}>
        <UiGlassShape castShadow receiveShadow />
      </Group>
    </>
  );
}
