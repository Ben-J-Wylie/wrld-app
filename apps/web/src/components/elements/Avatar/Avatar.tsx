import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

interface AvatarProps {
  avatarUrl?: string;
  username?: string;
  email?: string;
  size?: number;
  depth?: number;
  hoverDepthShift?: number;
  layout?: "inline" | "stacked";
  showText?: boolean;
  style?: React.CSSProperties;
}

export default function Avatar({
  avatarUrl,
  username,
  email,
  size = 120,
  depth = 0,
  hoverDepthShift = 1,
  layout = "inline",
  showText = true,
  style = {},
}: AvatarProps) {
  const { scale, device } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);
  const scaledSize = size * scale;
  const effectiveDepth = hovered ? depth + hoverDepthShift : depth;
  const initial = (username?.[0] || email?.[0] || "?").toUpperCase();

  const isInline = layout === "inline";

  return (
    <div
      className={`avatar-wrapper ${layout}`}
      style={{
        display: "flex",
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
      <ParallaxItem depth={effectiveDepth}>
        <div
          className={`avatar ${device}`}
          style={{
            width: `${scaledSize}px`,
            height: `${scaledSize}px`,
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="User Avatar" className="avatar-img" />
          ) : (
            <div className="avatar-initial">{initial}</div>
          )}
        </div>
      </ParallaxItem>

      {showText && (
        <ParallaxItem depth={effectiveDepth}>
          <div className="avatar-text">{username || email || "Unknown"}</div>
        </ParallaxItem>
      )}
    </div>
  );
}
