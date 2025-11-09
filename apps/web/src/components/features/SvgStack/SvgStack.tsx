import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

// Import your SVG layers here
import Vector1 from "../FeatureFrame/Vector1.svg?react";
import Vector2 from "../FeatureFrame/Vector2.svg?react";

const VECTOR_COMPONENTS = [Vector1, Vector2];

interface SvgStackProps {
  top: string;
  left: string;
  size?: number;
  depths?: number[];
  hoverDepthShift?: number;
  scale?: number;
  style?: React.CSSProperties;
  align?: "top" | "center" | "bottom"; // 🔹 new prop
}

export default function SvgStack({
  top,
  left,
  size = 500,
  depths = [0.1, 0.3],
  hoverDepthShift = 0.05,
  scale = 1,
  style = {},
  align = "bottom",
}: SvgStackProps) {
  const { scale: responsiveScale, parallaxStrength } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);

  const layers = VECTOR_COMPONENTS.map((SvgComponent, index) => {
    const baseDepth = depths[index] ?? 0;
    const adjustedDepth = hovered
      ? baseDepth + hoverDepthShift
      : baseDepth * parallaxStrength;

    return (
      <ParallaxItem
        key={index}
        depth={adjustedDepth}
        style={{
          position: "absolute",
          top: align === "top" ? "0" : align === "center" ? "50%" : "auto",
          bottom: align === "bottom" ? "0" : "auto",
          left,
          transform:
            align === "center"
              ? "translateY(-50%) scale(" + scale * responsiveScale + ")"
              : "scale(" + scale * responsiveScale + ")",
          transformOrigin:
            align === "bottom"
              ? "center bottom"
              : align === "top"
              ? "center top"
              : "center",
          pointerEvents: "none",
          zIndex: index + 1,
          width: `${size * responsiveScale}px`,
          height: `${size * responsiveScale}px`,
        }}
      >
        <SvgComponent
          width="100%"
          height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "block" }}
        />
      </ParallaxItem>
    );
  });

  return (
    <div
      className="svg-stack"
      style={{
        position: "absolute",
        top,
        left,
        width: `${size * responsiveScale}px`,
        height: `${size * responsiveScale}px`,
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {layers}
    </div>
  );
}
