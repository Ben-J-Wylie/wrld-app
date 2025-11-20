// Stage.tsx
import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";

import { StageContext } from "./StageContext";
import { createStage } from "./StageSystem";
import type { StageAPI } from "./StageSystem";
import { useWrldTheme } from "@/components/containers/SceneCore/Theme/WrldThemeProvider";

export interface StageProps {
  backdrop?: {
    presetSizes: {
      mobile: { width: number; height: number };
      tablet: { width: number; height: number };
      desktop: { width: number; height: number };
    };
    position?: [number, number, number];
  };
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function Stage({ backdrop, style, children }: StageProps) {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const stageRootRef = useRef<THREE.Object3D | null>(null);
  const [stageAPI, setStageAPI] = useState<StageAPI | null>(null);

  // -----------------------------------------------
  // THEME (React hook - safe here)
  // -----------------------------------------------
  const theme = useWrldTheme();

  // -----------------------------------------------
  // Stable themed backdrop config
  // (prevents infinite effect loops)
  // -----------------------------------------------
  const themedBackdrop = useMemo(() => {
    return backdrop
      ? { ...backdrop, color: theme.colors.background }
      : undefined;
  }, [backdrop, theme.colors.background]);

  // -----------------------------------------------
  // CREATE STAGE (only once)
  // -----------------------------------------------
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const stage = createStage(canvasContainerRef.current, {
      backdrop: themedBackdrop,
    });

    setStageAPI(stage);
    stageRootRef.current = stage.scene;

    return () => stage.cleanup();
  }, []); // ❗ create only ONCE

  // -----------------------------------------------
  // UPDATE BACKDROP COLOR WHEN THEME CHANGES
  // -----------------------------------------------
  useEffect(() => {
    if (!stageAPI || !themedBackdrop) return;
    stageAPI.setBackdropColor?.(themedBackdrop.color);
  }, [stageAPI, themedBackdrop?.color]);

  // -----------------------------------------------
  // Inject React children into stage root
  // -----------------------------------------------
  const injectedChildren =
    stageAPI && stageAPI.injectChildrenInto(stageRootRef, children);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* CANVAS LAYER */}
      <div
        ref={canvasContainerRef}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* REACT LAYER */}
      {stageAPI && (
        <StageContext.Provider value={stageAPI}>
          <div style={{ position: "relative", zIndex: 10 }}>
            {injectedChildren}
          </div>
        </StageContext.Provider>
      )}
    </div>
  );
}
