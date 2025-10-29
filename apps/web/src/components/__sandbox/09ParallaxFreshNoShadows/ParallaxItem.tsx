import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";

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

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    // --- Parallax movement based on element position vs viewport center ---
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

    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
  }, [scrollY, vw, vh, depth, strength, scaleFactor]);

  return (
    <div
      ref={outerRef}
      style={{
        position: "absolute",
        transform: "translate(-50%, -50%)", // anchor center instead of top-left
        ...style,
      }}
    >
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
