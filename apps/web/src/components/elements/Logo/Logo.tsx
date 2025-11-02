import React, { useState } from "react";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import "../../_main/main.css";
import WrldSVG from "./Logo.svg?react";

type WrldLogoProps = {
  layout?: "inline" | "stacked";
  iconDepth?: number;
  textDepth?: number;
  size?: number;
  hoverDepthShift?: number;
  style?: React.CSSProperties;
};

export default function WrldLogo({
  layout = "inline",
  iconDepth = 0,
  textDepth = 0,
  size = 200,
  hoverDepthShift = 0.1,
  style = {},
}: WrldLogoProps) {
  const { scale, parallaxStrength } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);

  const isInline = layout === "inline";

  const iconToTextRatio = isInline ? 0.3 : 0.25;
  const responsiveSize = size * scale;
  const iconDepthAdjusted = hovered
    ? iconDepth + hoverDepthShift
    : iconDepth * parallaxStrength;
  const textDepthAdjusted = hovered
    ? textDepth + hoverDepthShift
    : textDepth * parallaxStrength;
  const textSize = responsiveSize * iconToTextRatio;

  return (
    <div
      className={`logo ${layout}`}
      style={{
        flexDirection: isInline ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isInline ? "0.5em" : "0.25em",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon */}
      <ParallaxItem depth={iconDepthAdjusted}>
        <WrldSVG
          width={responsiveSize}
          height={responsiveSize}
          style={{ display: "block" }}
        />
      </ParallaxItem>

      {/* Text */}
      <ParallaxItem depth={textDepthAdjusted}>
        <h1
          className="logo-text"
          style={{
            fontSize: `${textSize}px`,
            margin: 0,
            letterSpacing: "0.05em",
            fontWeight: 200,
          }}
        >
          WRLD
        </h1>
      </ParallaxItem>
    </div>
  );
}
