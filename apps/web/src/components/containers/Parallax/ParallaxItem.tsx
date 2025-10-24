import React, { useEffect, useRef } from "react";
import { useParallaxScene } from "./ParallaxScene";

type Props = {
  depth?: number; // + = near (moves more), - = far (moves less)
  strength?: number;
  style?: React.CSSProperties; // e.g. { top, left }
  children: React.ReactNode;
};

const ParallaxItem: React.FC<Props> = ({
  depth = 1,
  strength = 40,
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

    const rect = outer.getBoundingClientRect();
    const cx = vw / 2;
    const cy = vh / 2;
    const ex = rect.left + rect.width / 2;
    const ey = rect.top + rect.height / 2;

    const normX = (ex - cx) / cx;
    const normY = (ey - cy) / cy;

    const tx = normX * depth * strength;
    const ty = normY * depth * strength;

    inner.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
  }, [scrollY, vw, vh, depth, strength]);

  return (
    <div ref={outerRef} style={{ position: "absolute", ...style }}>
      <div
        ref={innerRef}
        style={{
          willChange: "transform",
          transition: "transform 0.15s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ParallaxItem;
