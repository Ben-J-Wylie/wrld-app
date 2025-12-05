// SceneCore/Layers/Backdrop.tsx

import * as THREE from "three";
import React, { forwardRef, useMemo, useRef } from "react";
import { useSceneStore } from "../Store/SceneStore";
import { useWrldTheme } from "../Themes/WrldThemeProvider";

export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

interface BackdropProps {
  color?: THREE.ColorRepresentation;
  padding?: number; // uniform padding outward
}

export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  ({ color, padding = 100 }, forwardedRef) => {
    console.log("[RENDER] Backdrop");

    const theme = useWrldTheme();
    const width = useSceneStore((s) => s.sceneWidth);
    const height = useSceneStore((s) => s.sceneHeight);

    const planeRef = useRef<THREE.Mesh>(null!);
    const meshRef = (forwardedRef as React.RefObject<THREE.Mesh>) ?? planeRef;

    // Final background color: props → theme → fallback
    const finalColor = color ?? theme.colors.background ?? "#ffffff";

    // Expand Backdrop by padding
    const { drawWidth, drawHeight } = useMemo(() => {
      const grow = padding * 2;
      return {
        drawWidth: width + grow,
        drawHeight: height + grow,
      };
    }, [width, height, padding]);

    return (
      <group
        name="BackdropGroup"
        position={[0, 0, -0.01]} // behind content
      >
        {/* 
          BACKDROP PLANE 
          Clean, real-shadow compatible
        */}
        <mesh
          ref={meshRef}
          name="BackdropPlane"
          castShadow={false}
          receiveShadow={true}
        >
          <planeGeometry args={[drawWidth, drawHeight]} />
          <meshStandardMaterial
            color={finalColor}
            toneMapped={false}
            depthWrite={true}
            metalness={0}
            roughness={1}
          />
        </mesh>
      </group>
    );
  }
);

Backdrop.displayName = "Backdrop";
