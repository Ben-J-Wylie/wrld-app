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
  onClick?: () => void;
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
  onClick,
}: AvatarProps) {
  const { scale, parallaxStrength, device } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);

  const isInline = layout === "inline";

  const iconToTextRatio = isInline ? 0.25 : 0.25;
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
      className={`avatar ${layout}`}
      onClick={onClick}
      style={{
        flexDirection: isInline ? "row" : "column",
        justifyContent: isInline ? "flex-start" : "center",
        gap: isInline ? "0.5em" : "0.5em",

        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* 👈 Text first */}
      {showText && (username || email) && (
        <ParallaxItem depth={textDepthAdjusted}>
          <div
            className="avatar-text"
            style={{
              fontSize: `${textSize}px`,
              textAlign: "right",
              whiteSpace: "nowrap",
            }}
          >
            {username || email}
          </div>
        </ParallaxItem>
      )}

      {/* 👉 Avatar second */}
      <ParallaxItem depth={iconDepthAdjusted}>
        <div
          className={`avatar-icon ${device}`}
          style={{
            width: `${responsiveSize}px`,
            height: `${responsiveSize}px`,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={username || email || "User Avatar"}
              style={{}}
            />
          ) : (
            <span
              style={{
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
