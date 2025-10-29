import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";
import { useParallaxLight } from "./ParallaxLight";

type Props = {
  depth?: number;
  strength?: number;
  scaleFactor?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

const ParallaxItem: React.FC<Props> = ({
  depth = 0,
  strength = 8,
  scaleFactor = 0.005,
  style,
  children,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { scrollY, vw, vh } = useParallaxScene();
  const { x: lx, y: ly, intensity, color } = useParallaxLight();

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
    if (depth > 0) {
      const offset = depth * 10;
      const blur = 2 + depth * 4;
      const baseOpacity = Math.max(0, 0.6 - depth * 0.1);

      const sx = -lx * offset * intensity;
      const sy = -ly * offset * intensity;

      const shadowColor = color.replace(/rgba?\(([^)]+)\)/, (_, inner) => {
        const rgb = inner.split(",").slice(0, 3).join(",");
        return `rgba(${rgb}, ${baseOpacity})`;
      });

      shadow = `${sx}px ${sy}px ${blur}px ${shadowColor}`;
    }

    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    inner.style.filter = shadow === "none" ? "none" : `drop-shadow(${shadow})`;
  }, [scrollY, vw, vh, depth, strength, scaleFactor, lx, ly, intensity, color]);

  // ✅ Automatically center if both `top` and `left` are provided
  const centeredStyle =
    style?.top !== undefined && style?.left !== undefined
      ? { transform: "translate(-50%, -50%)", ...style }
      : style;

  return (
    <div ref={outerRef} style={{ position: "absolute", ...centeredStyle }}>
      <div
        ref={innerRef}
        style={{
          willChange: "transform, filter",
          transition: "transform 0.15s ease-out, filter 0.3s ease-out",
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
