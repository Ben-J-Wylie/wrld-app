import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

interface AvatarProps {
  layout?: "inline" | "stacked";
  avatarUrl?: string;
  username?: string;
  email?: string;
  size?: number;
  iconDepth?: number;
  textDepth?: number;
  hoverDepthShift?: number;
  showText?: boolean;
  style?: React.CSSProperties;
}

export default function Avatar({
  layout = "inline",
  avatarUrl,
  username,
  email,
  size = 200,
  iconDepth = 0,
  textDepth = 0,
  hoverDepthShift = 0.1,
  showText = true,
  style = {},
}: AvatarProps) {
  const { scale, parallaxStrength, device } = useResponsiveContext();
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

  // 🔸 Fallback for initials (if no avatarUrl)
  const initial = (username?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <div
      className={`avatar-wrapper ${layout}`}
      style={{
        display: "flex",
        flexDirection: isInline ? "row" : "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isInline ? "0.5em" : "1em",
        cursor: "pointer",
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 🔸 Text label */}
      {showText && (username || email) && (
        <ParallaxItem depth={textDepthAdjusted}>
          <div
            className="avatar-text"
            style={{
              fontSize: `${textSize}px`,
            }}
          >
            {username || email}
          </div>
        </ParallaxItem>
      )}

      {/* 🔹 Icon */}
      <ParallaxItem depth={iconDepthAdjusted}>
        <div
          className={`avatar ${device}`}
          style={{
            width: `${responsiveSize}px`,
            height: `${responsiveSize}px`,
            borderRadius: "50%",
            overflow: "hidden",
            backgroundColor: "#222",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username || email || "User Avatar"}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <span
              style={{
                color: "#fff",
                fontSize: `${textSize}px`,
              }}
            >
              {initial}
            </span>
          )}
        </div>
      </ParallaxItem>
    </div>
  );
}
