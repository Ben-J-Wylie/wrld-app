// @ts-nocheck

import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

interface FeatureLayer {
  id: string;
  Component?: React.FunctionComponent<React.SVGProps<SVGSVGElement>>;
  depth?: number;
  hoverDepthShift?: number;
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  rotation?: number;
  color?: string;
}

interface FeatureStackProps {
  top: string;
  left: string;
  layers: FeatureLayer[];
  size?: number;
}

export default function FeatureStack({
  top,
  left,
  size = 300,
  layers,
}: FeatureStackProps) {
  const { scale, parallaxStrength } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);

  const responsiveSize = size * scale;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: `${responsiveSize}px`,
        height: `${responsiveSize}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "auto",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {layers.map((layer) => {
        const {
          id,
          Component,
          depth = 0,
          hoverDepthShift = 0.1,
          width = responsiveSize,
          height = responsiveSize,
          offsetX = 0,
          offsetY = 0,
          opacity = 1,
          rotation = 0,
          color = "#fff",
        } = layer;

        const adjustedDepth = hovered
          ? depth + hoverDepthShift
          : depth * parallaxStrength;

        return (
          <ParallaxItem
            key={id}
            depth={adjustedDepth}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width,
              height,
              transform: `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) rotate(${rotation}deg)`,
              opacity,
            }}
          >
            {Component ? (
              <Component width="100%" height="100%" fill={color} />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: color,
                }}
              />
            )}
          </ParallaxItem>
        );
      })}
    </div>
  );
}
