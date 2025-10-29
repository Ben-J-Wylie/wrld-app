import React from "react";
import { useParallaxLight } from "./ParallaxLight";

/**
 * Lightweight shadow projection: fast and visually soft.
 * Each higher-depth object casts one shadow per lower layer.
 */
type Props = {
  casterDepth: number;
  receiverDepth: number;
  children: React.ReactNode;
};

export default function ShadowProjection({
  casterDepth,
  receiverDepth,
  children,
}: Props) {
  const { x, y, color, intensity } = useParallaxLight();

  const depthGap = casterDepth - receiverDepth;
  if (depthGap <= 0) return null;

  // --- Tuned constants for smooth performance ---
  const distanceScale = 8; // smaller offset
  const blurScale = 2; // modest blur
  const baseAlpha = 0.25; // subtle darkness

  const offsetX = -x * depthGap * distanceScale;
  const offsetY = -y * depthGap * distanceScale;
  const blur = depthGap * blurScale;
  const alpha = baseAlpha / (1 + depthGap * 0.4);

  const shadowColor = color.replace(/[\d.]+\)$/g, `${alpha * intensity})`);

  return (
    <div
      style={{
        position: "absolute",
        transform: "translateZ(0)", // force GPU compositing
        filter: `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${shadowColor})`,
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}
