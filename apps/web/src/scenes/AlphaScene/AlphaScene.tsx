// src/scenes/AlphaScene/AlphaScene.tsx
import { useEffect } from "react";
import { useSceneStore } from "@/components/containers/SceneCore/SceneStore";
import {
  BackgroundPlane,
  Group,
} from "@/components/containers/SceneCore/Layers";
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
    setSceneWidth(10);
    setSceneHeight(15);
  }, [setSceneWidth, setSceneHeight]);

  return (
    <>
      {/* 💡 Local lights */}
      <ambientLight intensity={0.4} />
      <directionalLight
        color={new THREE.Color("#ffffff")}
        intensity={0.8}
        position={[5, 5, 5]}
        castShadow
      />
      <pointLight color={"#88ccff"} intensity={0.6} position={[-3, 2, 3]} />

      {/* 🖼 Scene layers */}
      <BackgroundPlane
        src="https://dummyimage.com/1920x1080/111/fff.png&text=AlphaScene"
        depth={0}
      />

      <Group depth={1}>{/* Add midground objects here */}</Group>

      <Group depth={3}>{/* Add foreground objects here */}</Group>
    </>
  );
}
