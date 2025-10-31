import React from "react";
import ParallaxItem from "../ParallaxItem";
import { useParallaxShadow } from "../useParallaxShadow";

type Props = {
  top: string;
  left: string;
  size?: number;
  color?: string;
};

export default function OvalStack({
  top,
  left,
  size = 50,
  color = "#55f",
}: Props) {
  const oval = (opacity: number, depth: number, rx = 120, ry = 60) => {
    const shadow = useParallaxShadow(depth);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={{
          filter: `drop-shadow(${shadow})`, // 👈 depth-aware shadow
        }}
      >
        <ellipse
          cx="150"
          cy="150"
          rx={rx}
          ry={ry}
          fill={color}
          opacity={opacity}
        />
      </svg>
    );
  };

  return (
    <>
      <ParallaxItem depth={1} style={{ top, left }}>
        {oval(1, 1, 110, 55)} {/* far layer, smaller oval */}
      </ParallaxItem>
      <ParallaxItem depth={2} style={{ top, left }}>
        {oval(1, 2, 120, 60)}
      </ParallaxItem>
      <ParallaxItem depth={3} style={{ top, left }}>
        {oval(1, 3, 130, 65)} {/* near layer, slightly larger oval */}
      </ParallaxItem>
    </>
  );
}
