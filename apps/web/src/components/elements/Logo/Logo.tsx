// WITH BASE SIZE

// import React from "react";
// import ParallaxItem from "../../containers/Parallax/ParallaxItem";
// import "../../_main/main.css";
// import WrldSVG from "./Logo.svg?react";

// type WrldLogoProps = {
//   layout?: "stacked" | "inline";
//   iconDepth?: number;
//   textDepth?: number;
//   size?: number;
// };

// export default function WrldLogo({
//   layout = "inline",
//   iconDepth = 1,
//   textDepth = 1,
//   size = 150,
// }: WrldLogoProps) {
//   const isInline = layout === "inline";

//   // ✅ Independent internal ratios
//   const iconToTextRatioStacked = 0.2; // tweak as needed
//   const iconToTextRatioInline = 0.3; // tweak as needed
//   const iconToTextRatio = isInline
//     ? iconToTextRatioInline
//     : iconToTextRatioStacked;

//   // Base internal size references
//   const baseSize = 300; // internal "design size" reference
//   const textSize = baseSize * iconToTextRatio;

//   return (
//     <div
//       className={`logo ${isInline ? "inline" : "stacked"}`}
//       style={{
//         display: "flex",
//         flexDirection: isInline ? "row" : "column",
//         alignItems: "center",
//         justifyContent: "center",
//         gap: isInline ? size * 0 : size * 0,
//         transform: `scale(${size / baseSize})`, // master scale
//       }}
//     >
//       {/* Icon Layer */}
//       <ParallaxItem depth={iconDepth}>
//         <WrldSVG
//           width={baseSize}
//           height={baseSize}
//           style={{
//             color: "var(--wrld-logo-color, rgba(0, 0, 0, 1))",
//             display: "block",
//           }}
//         />
//       </ParallaxItem>

//       {/* Text Layer */}
//       <ParallaxItem depth={textDepth}>
//         <h1
//           className="logo-text"
//           style={{
//             fontSize: textSize,
//           }}
//         >
//           WRLD
//         </h1>
//       </ParallaxItem>
//     </div>
//   );
// }

// WITHOUT BASE SIZE

// import React from "react";
// import ParallaxItem from "../../containers/Parallax/ParallaxItem";
// import "../../_main/main.css";
// import WrldSVG from "./Logo.svg?react";

// type WrldLogoProps = {
//   layout?: "stacked" | "inline";
//   iconDepth?: number;
//   textDepth?: number;
//   size?: number; // overall logo scale
// };

// export default function WrldLogo({
//   layout = "inline",
//   iconDepth = 0,
//   textDepth = 0,
//   size = 100,
// }: WrldLogoProps) {
//   const isInline = layout === "inline";

//   // independent internal ratios
//   const iconToTextRatioStacked = 0.25;
//   const iconToTextRatioInline = 0.3;
//   const iconToTextRatio = isInline
//     ? iconToTextRatioInline
//     : iconToTextRatioStacked;

//   const textSize = size * iconToTextRatio;
//   const gap = isInline ? size * 0 : size * 0;

//   return (
//     <div
//       className={`logo ${isInline ? "inline" : "stacked"}`}
//       style={{
//         display: "flex",
//         flexDirection: isInline ? "row" : "column",
//         alignItems: "center",
//         justifyContent: "center",
//         gap,
//       }}
//     >
//       {/* Icon Layer */}
//       <ParallaxItem depth={iconDepth}>
//         <WrldSVG
//           width={size}
//           height={size}
//           style={{
//             color: "var(--logo-color, rgba(0, 0, 0, 1))",
//             display: "block",
//           }}
//         />
//       </ParallaxItem>

//       {/* Text Layer */}
//       <ParallaxItem depth={textDepth}>
//         <h1
//           className="logo-text"
//           style={{
//             fontSize: textSize,
//           }}
//         >
//           WRLD
//         </h1>
//       </ParallaxItem>
//     </div>
//   );
// }

// RESPONSIVE

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
