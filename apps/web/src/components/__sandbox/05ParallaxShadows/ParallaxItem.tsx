import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";

type Props = {
  depth?: number; // + = near (moves more), - = far (moves less)
  strength?: number; // movement intensity
  scaleFactor?: number; // how much scaling to apply per depth unit
  style?: React.CSSProperties; // e.g. { top, left }
  children: React.ReactNode;
};

const ParallaxItem: React.FC<Props> = ({
  depth = 1,
  strength = 8,
  scaleFactor = 0.005, // adjust to taste (0.03 subtle, 0.1 dramatic)
  style,
  children,
}) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { scrollY, vw, vh } = useParallaxScene();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // Measure untransformed position
    const rect = outer.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;

    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;

    // Translation intensity
    const tx = normX * depth * strength;
    const ty = normY * depth * strength;

    // Perspective-style scaling
    const scale = 1 + depth * scaleFactor;

    // Apply both translation and scale together
    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }, [scrollY, vw, vh, depth, strength, scaleFactor]);

  return (
    <div ref={outerRef} style={{ position: "absolute", ...style }}>
      <div
        ref={innerRef}
        style={{
          willChange: "transform",
          transition: "transform 0.15s ease-out",
          transformOrigin: "center center",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
