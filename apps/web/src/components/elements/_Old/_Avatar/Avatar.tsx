import React, { useState } from "react";
import { useResponsiveContext } from "../../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../../containers/Parallax/ParallaxItem";
import "./Avatar.css";

interface AvatarProps {
  avatarUrl?: string;
  username?: string;
  email?: string;
  size?: number;
  depth?: number;
  hoverDepthShift?: number;
  style?: React.CSSProperties;
}

export default function Avatar({
  avatarUrl,
  username,
  email,
  size = 100,
  depth = 0,
  hoverDepthShift = -1.5,
  style = {},
}: AvatarProps) {
  const { scale, device } = useResponsiveContext();
  const scaledSize = size * scale;
  const [hovered, setHovered] = useState(false);
  const effectiveDepth = hovered ? depth + hoverDepthShift : depth;
  const initial = (username?.[0] || email?.[0] || "?").toUpperCase();

  return (
    <ParallaxItem
      depth={effectiveDepth}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
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
  );
}
