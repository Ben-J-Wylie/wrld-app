import { useEffect, useRef } from "react";
import { createStage } from "./StageSystem"; // the Stage file we finalized

export interface StageProps {
  backdrop?: {
    presetSizes: {
      mobile: { width: number; height: number };
      tablet: { width: number; height: number };
      desktop: { width: number; height: number };
    };
    position?: [number, number, number];
  };

  objects?: any[];

  style?: React.CSSProperties;
}

export function Stage({ backdrop, objects, style }: StageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Build pipeline
    stageRef.current = createStage(containerRef.current, {
      backdrop,
      objects,
    });

    return () => stageRef.current?.cleanup();
  }, [backdrop, objects]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
