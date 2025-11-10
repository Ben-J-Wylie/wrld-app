// // src/parallax/BackgroundPlane.tsx
// import { useEffect, useRef } from "react";
// import { Mesh } from "three";
// import { useParallaxStore } from "./ParallaxStore";
// import { ParallaxGroup } from "./ParallaxGroup";
// import { ParallaxConfig } from "./ParallaxConfig";

// interface BackgroundPlaneProps {
//   width?: number;
//   height?: number;
//   depth?: number;
//   color?: string;
// }

// export function BackgroundPlane({
//   width = ParallaxConfig.scene.layerDefaults.width * 2.5,
//   height = 20,
//   depth = ParallaxConfig.scene.background.depth,
//   color = "#222",
// }: BackgroundPlaneProps) {
//   const meshRef = useRef<Mesh>(null);
//   const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);

//   useEffect(() => {
//     if (meshRef.current) {
//       const worldHeight = height;
//       setBackgroundHeight(worldHeight);
//     }
//   }, [height, setBackgroundHeight]);

//   return (
//     <ParallaxGroup depth={depth}>
//       <mesh ref={meshRef}>
//         <planeGeometry args={[width, height]} />
//         <meshStandardMaterial color={color} />
//       </mesh>
//     </ParallaxGroup>
//   );
// }

// src/parallax/BackgroundPlane.tsx
import { useEffect, useRef } from "react";
import { Mesh, TextureLoader } from "three";
import { useLoader } from "@react-three/fiber";
import { useParallaxStore } from "./ParallaxStore";
import { ParallaxGroup } from "./ParallaxGroup";
import { ParallaxConfig } from "./ParallaxConfig";

interface BackgroundPlaneProps {
  src: string; // 🆕 image source path (e.g., "./background.jpg")
  width?: number;
  height?: number;
  depth?: number;
}

/**
 * BackgroundPlane
 * ------------------------------------------------------------
 * Renders an image-based background plane.
 * Still reports its world-space height to the ParallaxStore for
 * camera scroll calibration.
 */
export function BackgroundPlane({
  src,
  width = ParallaxConfig.scene.layerDefaults.width * 2.5,
  height = 80,
  depth = ParallaxConfig.scene.background.depth,
}: BackgroundPlaneProps) {
  const meshRef = useRef<Mesh>(null);
  const texture = useLoader(TextureLoader, src);
  const setBackgroundHeight = useParallaxStore((s) => s.setBackgroundHeight);

  // Report height to store for camera travel range calculation
  useEffect(() => {
    if (meshRef.current) {
      setBackgroundHeight(height);
    }
  }, [height, setBackgroundHeight]);

  return (
    <ParallaxGroup depth={depth}>
      <mesh ref={meshRef}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </ParallaxGroup>
  );
}
