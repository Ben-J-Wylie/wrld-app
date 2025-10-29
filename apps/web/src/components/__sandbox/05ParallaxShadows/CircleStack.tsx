import React from "react";
import ParallaxItem from "./ParallaxItem";
import { useParallaxShadow } from "./useParallaxShadow";

type Props = {
  top: string;
  left: string;
  strength?: number;
  size?: number;
  color?: string;
};

export default function CircleStack({
  top,
  left,
  size = 50,
  color = "#55f",
}: Props) {
  const circle = (opacity: number, depth: number) => {
    // 👇 compute the correct shadow for this depth
    const shadow = useParallaxShadow(depth);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={{
          filter: `drop-shadow(${shadow})`, // 👈 apply the shadow
        }}
      >
        <circle cx="150" cy="150" r="80" fill={color} opacity={opacity} />
      </svg>
    );
  };

  return (
    <>
      <ParallaxItem depth={1} style={{ top, left }}>
        {circle(1, 1)}
      </ParallaxItem>
      <ParallaxItem depth={2} style={{ top, left }}>
        {circle(1, 2)}
      </ParallaxItem>
      <ParallaxItem depth={3} style={{ top, left }}>
        {circle(1, 3)}
      </ParallaxItem>
    </>
  );
}
