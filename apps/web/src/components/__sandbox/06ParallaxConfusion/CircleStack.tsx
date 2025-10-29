import React from "react";
import ParallaxItem from "./ParallaxItem";
import { useParallaxShadow } from "./useParallaxShadow";

type Props = {
  top: string;
  left: string;
  size?: number;
  color?: string;
};

export default function CircleStack({
  top,
  left,
  size = 200,
  color = "#55f",
}: Props) {
  const circle = (opacity: number, depth: number) => {
    const shadow = useParallaxShadow(depth);
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 300 300"
        style={{ filter: `drop-shadow(${shadow})` }}
      >
        <circle cx="150" cy="150" r="80" fill={color} opacity={opacity} />
      </svg>
    );
  };

  // A helper so depth only needs to be declared once
  const CircleLayer = ({
    opacity,
    depth,
  }: {
    opacity: number;
    depth: number;
  }) => (
    <ParallaxItem depth={depth} style={{ top, left }}>
      {circle(opacity, depth)}
    </ParallaxItem>
  );

  return (
    <>
      <CircleLayer opacity={1} depth={5} />
      <CircleLayer opacity={1} depth={6} />
    </>
  );
}
