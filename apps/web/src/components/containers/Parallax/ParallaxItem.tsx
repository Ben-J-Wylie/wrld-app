import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";
import { useResponsiveContext } from "../Responsive/ResponsiveContext";

type Props = {
  depth?: number;
  strength?: number;
  scaleFactor?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const ParallaxItem: React.FC<Props> = ({
  depth = 0,
  strength = 3,
  scaleFactor = 0.005,
  style,
  children,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const { scrollY, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight();
  const {
    shadowBlur,
    shadowOpacity,
    shadowGrowth,
    shadowOffsetScale,
    shadowFalloff,
  } = useResponsiveContext();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // --- Parallax movement ---
    const rect = outer.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;
    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;
    const tx = normX * depth * strength;
    const ty = normY * depth * strength;
    const scale = 1 + depth * scaleFactor;

    // --- Shadow physics ---
    let shadow = "none";
    if (depth !== 0) {
      const absDepth = Math.abs(depth);

      // Device-scaled parameters
      const offset = absDepth * shadowOffsetScale * 3;
      const blur = shadowBlur + absDepth * shadowGrowth * 1.4;
      const baseOpacity = Math.max(
        0,
        shadowOpacity - absDepth * shadowFalloff * 0.05
      );

      // Reverse direction depending on depth sign (for layering illusion)
      const dir = depth > 0 ? -1 : 1;
      const sx = dir * lx * offset * intensity;
      const sy = dir * ly * offset * intensity;

      const shadowColor = color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
        const rgb = inner.split(",").slice(0, 3).join(",");
        return `rgba(${rgb}, ${baseOpacity.toFixed(2)})`;
      });

      shadow = `${sx.toFixed(2)}px ${sy.toFixed(2)}px ${blur.toFixed(
        2
      )}px ${shadowColor}`;
    }

    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    inner.style.filter = shadow === "none" ? "none" : `drop-shadow(${shadow})`;
  }, [
    scrollY,
    vw,
    vh,
    depth,
    strength,
    scaleFactor,
    lx,
    ly,
    intensity,
    color,
    shadowBlur,
    shadowOpacity,
    shadowGrowth,
    shadowOffsetScale,
    shadowFalloff,
  ]);

  // ✅ Automatically center if both `top` and `left` are defined
  const centeredStyle =
    style?.top !== undefined && style?.left !== undefined
      ? { transform: "translate(-50%, -50%)", ...style }
      : style;

  return (
    <div ref={outerRef} style={{ position: "relative", ...centeredStyle }}>
      <div
        ref={innerRef}
        style={{
          transformOrigin: "center center",
          willChange: "transform, filter",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
