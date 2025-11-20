// @ts-nocheck

// import React, { useState } from "react";
// import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
// import ParallaxItem from "../../containers/Parallax/ParallaxItem";
// import "../../_main/main.css";

// interface AvatarProps {
//   layout?: "inline" | "stacked";
//   avatarUrl?: string;
//   username?: string;
//   email?: string;
//   size?: number;
//   iconDepth?: number;
//   textDepth?: number;
//   hoverDepthShift?: number;
//   showText?: boolean;
//   style?: React.CSSProperties;
//   onClick?: () => void;
// }

// export default function Avatar({
//   layout = "inline",
//   avatarUrl,
//   username,
//   email,
//   size = 200,
//   iconDepth = 0,
//   textDepth = 0,
//   hoverDepthShift = 0.1,
//   showText = true,
//   style = {},
//   onClick,
// }: AvatarProps) {
//   const { scale, parallaxStrength, device } = useResponsiveContext();
//   const [hovered, setHovered] = useState(false);

//   const isInline = layout === "inline";

//   const iconToTextRatio = isInline ? 0.25 : 0.25;
//   const responsiveSize = size * scale;
//   const iconDepthAdjusted = hovered
//     ? iconDepth + hoverDepthShift
//     : iconDepth * parallaxStrength;
//   const textDepthAdjusted = hovered
//     ? textDepth + hoverDepthShift
//     : textDepth * parallaxStrength;
//   const textSize = responsiveSize * iconToTextRatio;

//   // 🔸 Fallback for initials (if no avatarUrl)
//   const initial = (username?.[0] || email?.[0] || "?").toUpperCase();

//   return (
//     <div
//       className={`avatar ${layout}`}
//       onClick={onClick}
//       style={{
//         flexDirection: isInline ? "row" : "column",
//         justifyContent: isInline ? "flex-start" : "center",
//         gap: isInline ? "0.5em" : "0.5em",

//         ...style,
//       }}
//       onMouseEnter={() => setHovered(true)}
//       onMouseLeave={() => setHovered(false)}
//     >
//       {/* 👈 Text first */}
//       {showText && (username || email) && (
//         <ParallaxItem depth={textDepthAdjusted}>
//           <div
//             className="avatar-text"
//             style={{
//               fontSize: `${textSize}px`,
//               textAlign: "right",
//               whiteSpace: "nowrap",
//             }}
//           >
//             {username || email}
//           </div>
//         </ParallaxItem>
//       )}

//       {/* 👉 Avatar second */}
//       <ParallaxItem depth={iconDepthAdjusted}>
//         <div
//           className={`avatar-icon ${device}`}
//           style={{
//             width: `${responsiveSize}px`,
//             height: `${responsiveSize}px`,
//           }}
//         >
//           {avatarUrl ? (
//             <img
//               src={avatarUrl}
//               alt={username || email || "User Avatar"}
//               style={{ width: "100%", height: "100%", objectFit: "cover" }}
//             />
//           ) : (
//             <span style={{ fontSize: `${textSize}px` }}>{initial}</span>
//           )}
//         </div>
//       </ParallaxItem>
//     </div>
//   );
// }

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
  style?: React.CSSProperties; // ✅ custom inline styles
  onClick?: () => void; // ✅ interaction handler
}

interface FeatureStackProps {
  top: string;
  left: string;
  layers: FeatureLayer[];
  size?: number;
  style?: React.CSSProperties; // ✅ container-level styling
  onClick?: () => void; // ✅ container-level interaction
}

export default function FeatureStack({
  top,
  left,
  size = 300,
  layers,
  style = {},
  onClick,
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
        ...style, // ✅ allow custom outer styling
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick} // ✅ allow click at stack level
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
          style: layerStyle = {},
          onClick: layerClick,
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
              ...layerStyle, // ✅ custom per-layer styles
            }}
            onClick={layerClick} // ✅ handle click per layer
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
