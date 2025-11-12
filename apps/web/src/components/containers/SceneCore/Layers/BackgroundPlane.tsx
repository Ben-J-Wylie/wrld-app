import React, { useRef } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";
import { useSceneStore } from "../SceneStore";
import { Group } from "./Group";
import { SceneConfig } from "../SceneConfig";

/**
 * BackgroundPlane
 * -----------------------------------------------------------------------------
 * Renders the flat background image for the 3D scene.
 *
 * This component is **read-only** — it does NOT define scene size anymore.
 * Instead, it reads the current scene width and height from the SceneStore,
 * which are maintained elsewhere (for example, by DemoScene or layout logic).
 *
 * Purpose:
 *   - Display a textured plane that represents the back of the 3D scene.
 *   - Stay in sync with scene dimensions defined in the SceneStore.
 *   - Use SceneConfig values only as safe fallbacks if the store is uninitialized.
 *
 * Data flow:
 *   SceneConfig → SceneStore → BackgroundPlane → Camera/Render
 */
interface BackgroundPlaneProps {
  src: string; // Background image texture file
  width?: number; // Optional manual override for scene width
  height?: number; // Optional manual override for scene height
  depth?: number; // Z-position in the scene (from SceneConfig by default)
}

export function BackgroundPlane({
  src,
  width,
  height,
  depth = SceneConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  // 🔹 Reference to the mesh (for debugging or manual inspection)
  const meshRef = useRef<THREE.Mesh>(null);

  // 🔹 Load the texture from the provided image source
  const texture = useLoader(THREE.TextureLoader, src);

  // 🔹 Read current scene dimensions from the SceneStore
  // These are live, reactive values — if another file (like DemoScene)
  // calls setSceneWidth/Height, the BackgroundPlane automatically re-renders.
  const sceneWidth = useSceneStore((s) => s.sceneWidth);
  const sceneHeight = useSceneStore((s) => s.sceneHeight);

  // ---------------------------------------------------------------------------
  // 🎨 Determine the final plane dimensions (in world units)
  // ---------------------------------------------------------------------------
  // Priority of values:
  // 1️⃣ Props passed directly to BackgroundPlane (manual override)
  // 2️⃣ Reactive values from SceneStore (dynamic, updated elsewhere)
  // 3️⃣ Fallbacks from SceneConfig (static design defaults)
  const planeWidth =
    width ?? sceneWidth ?? SceneConfig.scene.background.sceneWidth;
  const planeHeight =
    height ??
    sceneHeight ??
    SceneConfig.scene.background.sceneHeight ??
    planeWidth;

  // ---------------------------------------------------------------------------
  // 🧱 Render the background plane
  // ---------------------------------------------------------------------------
  // <Group> offsets the plane along the Z-axis.
  // The <planeGeometry> uses the computed dimensions.
  // The <meshStandardMaterial> applies the loaded texture.
  return (
    <Group depth={depth}>
      <mesh ref={meshRef} position={[0, 0, 0]} receiveShadow>
        {/* Flat rectangle geometry in world units */}
        <planeGeometry args={[planeWidth, planeHeight]} />

        {/* Image texture with simple, realistic lighting response */}
        <meshStandardMaterial
          map={texture}
          toneMapped
          roughness={1}
          metalness={0}
          side={THREE.DoubleSide} // visible from both sides
        />
      </mesh>
    </Group>
  );
}

/* -------------------------------------------------------------------------- */
/* 🧭 Data Flow Diagram — Read-Only Architecture                              */
/* -------------------------------------------------------------------------- */

/*
┌─────────────────────────────┐
│        SceneConfig          │
│  (static design defaults)   │
│─────────────────────────────│
│  sceneWidth:   10           │
│  sceneHeight:  30           │
│  depth:         0           │
└──────────────┬──────────────┘
               │
               │ (used as fallback defaults)
               ▼
┌─────────────────────────────┐
│        SceneStore           │
│  (shared reactive state)    │
│─────────────────────────────│
│  sceneWidth:   10           │
│  sceneHeight:  15   ✅ true │ ← updated by external file (e.g. DemoScene)
│  visibleHeight: computed    │
│  scroll: dynamic value      │
└──────────────┬──────────────┘
               │
               │ (reactive subscription)
               ▼
┌─────────────────────────────┐
│      BackgroundPlane        │
│─────────────────────────────│
│ - Loads texture image       │
│ - Reads width/height → store│
│ - Falls back → config if undefined |
│ - Reads depth → config      │
│ - Renders plane (10 × 15)   │
└──────────────┬──────────────┘
               │
               │ (used by)
               ▼
┌─────────────────────────────┐
│   FitPerspectiveCamera      │
│─────────────────────────────│
│ - Watches store values      │
│ - Calculates dynamic FOV    │
│ - Adjusts scroll bounds     │
│ - Updates projection matrix │
└──────────────┬──────────────┘
               │
               │ (affects render)
               ▼
┌─────────────────────────────┐
│        Rendered Scene       │
│─────────────────────────────│
│ - Background = correct size │
│ - Camera scrolls properly   │
│ - FOV matches scene height  │
└─────────────────────────────┘
*/
