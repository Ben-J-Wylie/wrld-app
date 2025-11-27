// SceneCore/Layers/Backdrop.tsx

import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";
import { useSceneStore } from "../Store/SceneStore";
import { useWrldTheme } from "../Themes/WrldThemeProvider";

// ----------------------------------
// EXPORT ONLY the dimensions type
// ----------------------------------
export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

// ----------------------------------
// INTERNAL ONLY props (not exported)
// ----------------------------------
interface BackdropProps {
  color?: THREE.ColorRepresentation;
  padding?: number; // uniform padding
}

// ----------------------------------
// Backdrop component (reads store + theme)
// ----------------------------------
export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  ({ color, padding = 100 }, ref) => {
    const theme = useWrldTheme();

    const width = useSceneStore((s) => s.sceneWidth);
    const height = useSceneStore((s) => s.sceneHeight);

    // Determine background color:
    // prop override wins → otherwise theme → fallback manual hex
    const finalColor = color ?? theme.colors.background ?? "#ffffff";

    const { drawWidth, drawHeight } = useMemo(() => {
      const grow = padding * 2;
      return {
        drawWidth: width + grow,
        drawHeight: height + grow,
      };
    }, [width, height, padding]);

    return (
      <mesh ref={ref} receiveShadow>
        <planeGeometry args={[drawWidth, drawHeight]} />
        <meshStandardMaterial color={finalColor} />
      </mesh>
    );
  }
);

Backdrop.displayName = "Backdrop";
