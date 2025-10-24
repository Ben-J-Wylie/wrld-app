import React from "react";
import ParallaxItem from "../Parallax/ParallaxItem";

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
  strength = 40,
  size = 300,
  color = "#55f",
}: Props) {
  const circle = (opacity: number) => (
    <svg width={size} height={size} viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="80" fill={color} opacity={opacity} />
    </svg>
  );

  return (
    <>
      <ParallaxItem depth={0} strength={strength} style={{ top, left }}>
        {circle(0.4)}
      </ParallaxItem>
      <ParallaxItem depth={1} strength={strength} style={{ top, left }}>
        {circle(0.7)}
      </ParallaxItem>
      <ParallaxItem depth={2} strength={strength} style={{ top, left }}>
        {circle(1)}
      </ParallaxItem>
    </>
  );
}
