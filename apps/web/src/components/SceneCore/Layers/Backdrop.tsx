import * as THREE from "three";
import React, { forwardRef, useMemo } from "react";
import { useSceneStore } from "../Store/SceneStore";

// ----------------------------------
// Exported dimensions type
// ----------------------------------
export interface BackdropDimensions {
  mobile: { width: number; height: number };
  tablet: { width: number; height: number };
  desktop: { width: number; height: number };
}

interface BackdropProps {
  color?: THREE.ColorRepresentation;
  padding?: number; // uniform padding on all sides
  paddingX?: number; // horizontal padding (left+right)
  paddingY?: number; // vertical padding (top+bottom)
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
}

// ----------------------------------
// Backdrop component (reads store)
// ----------------------------------
export const Backdrop = forwardRef<THREE.Mesh, BackdropProps>(
  (
    {
      color = "#dc4c4c",
      padding = 50,
      paddingX,
      paddingY,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
    },
    ref
  ) => {
    // Store-driven "true world size"
    const width = useSceneStore((s) => s.sceneWidth);
    const height = useSceneStore((s) => s.sceneHeight);

    // ---------------------------------------------
    // Resolve padding rules
    // ---------------------------------------------
    const { pLeft, pRight, pTop, pBottom } = useMemo(() => {
      const p = padding;
      const px = paddingX ?? p;
      const py = paddingY ?? p;

      return {
        pLeft: paddingLeft ?? px,
        pRight: paddingRight ?? px,
        pTop: paddingTop ?? py,
        pBottom: paddingBottom ?? py,
      };
    }, [
      padding,
      paddingX,
      paddingY,
      paddingTop,
      paddingBottom,
      paddingLeft,
      paddingRight,
    ]);

    // ---------------------------------------------
    // COMPUTED BACKDROP DRAW SIZE
    // (store + padding)
    // ---------------------------------------------
    const drawWidth = width + pLeft + pRight;
    const drawHeight = height + pTop + pBottom;

    return (
      <mesh ref={ref}>
        <planeGeometry args={[drawWidth, drawHeight]} />
        <meshBasicMaterial color={color} />
      </mesh>
    );
  }
);

Backdrop.displayName = "Backdrop";
