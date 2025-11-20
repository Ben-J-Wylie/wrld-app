import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

interface MenuEntryProps {
  label: string;
  depth?: number;
  hoverDepthShift?: number;
  onClick?: () => void;
  href?: string;
  style?: React.CSSProperties;
}

export default function MenuEntry({
  label,
  depth = 0,
  hoverDepthShift = 0.1,
  onClick,
  href,
  style = {},
}: MenuEntryProps) {
  const { scale, parallaxStrength } = useResponsiveContext();
  const [hovered, setHovered] = useState(false);

  const maxChars = 20;
  const displayLabel =
    label.length > maxChars ? label.slice(0, maxChars) + "…" : label;

  const handleClick = () => {
    if (onClick) onClick();
    else if (href) window.location.href = href;
  };

  // BEFORE
  // const entryDepth = hovered
  //   ? depth + hoverDepthShift
  //   : depth * parallaxStrength;

  // AFTER
  const baseDepth = depth * parallaxStrength;
  const entryDepth = hovered ? baseDepth + hoverDepthShift : baseDepth;

  return (
    <ParallaxItem depth={entryDepth}>
      <div
        className="menu-entry"
        style={{
          padding: `${4 * scale}px ${8 * scale}px`,
          fontSize: `${12 * scale}px`,
          ...style,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={handleClick}
      >
        {displayLabel}
      </div>
    </ParallaxItem>
  );
}
