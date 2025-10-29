import React from "react";
import ParallaxItem from "./ParallaxItem";

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
  const circle = (opacity: number) => (
    <svg width={size} height={size} viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="80" fill={color} opacity={opacity} />
    </svg>
  );

  const CircleLayer = ({
    opacity,
    depth,
  }: {
    opacity: number;
    depth: number;
  }) => (
    <ParallaxItem depth={depth} style={{ top, left }}>
      {circle(opacity)}
    </ParallaxItem>
  );

  return (
    <>
      <CircleLayer opacity={1} depth={5} />
      <CircleLayer opacity={1} depth={9} />
    </>
  );
}
