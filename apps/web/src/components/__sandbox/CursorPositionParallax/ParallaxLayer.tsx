import React from "react";
import { useParallax } from "./ParallaxProvider";

type Props = {
  depth: number;
  strength?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
};

export const ParallaxLayer: React.FC<Props> = ({
  depth,
  strength = 30,
  children,
  style = {},
}) => {
  const { x, y } = useParallax();
  const translateX = -x * depth * strength;
  const translateY = -y * depth * strength;

  const layerStyle: React.CSSProperties = {
    transform: `translate3d(${translateX}px, ${translateY}px, 0)`,
    transition: "transform 0.05s ease-out",
    position: "absolute",
    ...style,
  };

  return <div style={layerStyle}>{children}</div>;
};
