import React from "react";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import "./Logo.css";
import WrldSVG from "./Logo.svg?react";

type WrldLogoProps = {
  layout?: "inline" | "stacked";
  iconDepth?: number;
  textDepth?: number;
  size?: number;
};

export default function WrldLogo({
  layout = "inline",
  iconDepth = 0,
  textDepth = 0,
  size = 200,
}: WrldLogoProps) {
  const { scale, parallaxStrength } = useResponsiveContext();

  const isInline = layout === "inline";

  // 🔹 Independent internal ratios for layout types
  const iconToTextRatioStacked = 0.25;
  const iconToTextRatioInline = 0.3;
  const iconToTextRatio = isInline
    ? iconToTextRatioInline
    : iconToTextRatioStacked;

  // 🔹 Apply global responsive scaling
  const responsiveSize = size * scale;
  const iconDepthAdjusted = iconDepth * parallaxStrength;
  const textDepthAdjusted = textDepth * parallaxStrength;

  // 🔹 Text size derived from icon-to-text ratio
  const textSize = responsiveSize * iconToTextRatio;

  return (
    <div
      className={`logo ${layout}`}
      style={{
        flexDirection: isInline ? "row" : "column",
      }}
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
          }}
        >
          WRLD
        </h1>
      </ParallaxItem>
    </div>
  );
}
