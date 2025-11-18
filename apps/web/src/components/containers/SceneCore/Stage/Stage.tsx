import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { StageContext } from "./StageContext";
import { createStage } from "./StageSystem";
import type { StageAPI } from "./StageSystem";

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

  // Init stage once the canvas container exists
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    console.log("Stage.tsx → createStage");
    const stage = createStage(canvasContainerRef.current, { backdrop });
    setStageAPI(stage);
    stageRootRef.current = stage.scene;

    return () => stage.cleanup();
    // usually you'd not depend on `backdrop` unless you really want to recreate
    // the whole stage when it changes. For now we keep it here because that's
    // how you had it, but [] is often safer.
  }, [backdrop]);

  // If stageAPI exists, inject __parent for the scene root
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
      {/* CANVAS LAYER: mounted once and never unmounted */}
      <div
        ref={canvasContainerRef}
        style={{ position: "absolute", inset: 0 }}
      />

      {/* REACT LAYER: only appears once stageAPI is ready */}
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
