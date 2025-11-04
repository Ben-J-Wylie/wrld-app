import React from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import WrldLogo from "../../elements/Logo/Logo";
import Avatar from "../../elements/Avatar/Avatar";
import "./Header.css";

interface HeaderProps {
  depth?: number;
}

export default function Header({ depth = 0 }: HeaderProps) {
  const { scale, device } = useResponsiveContext();

  // 🔹 Responsive sizing
  const headerHeight = 100 * scale;
  const logoSize = 100; // base size
  const avatarSize = 60;

  // 🔹 Layout spacing
  const paddingX = device === "mobile" ? 16 : 32;
  const paddingY = device === "mobile" ? 8 : 16;

  return (
    <ParallaxItem
      depth={depth}
      fixed
      style={{
        top: 0,
        left: 0,
        width: "100%",
        zIndex: 100,
      }}
    >
      <header
        className="header"
        style={{
          height: `${headerHeight}px`,
          padding: `${paddingY}px ${paddingX}px`,
        }}
      >
        {/* Left: Logo */}
        <div className="header-left">
          <WrldLogo
            layout="inline"
            size={logoSize}
            iconDepth={0.1}
            textDepth={0}
          />
        </div>

        {/* Right: Avatar */}
        <div className="header-right">
          <Avatar
            layout="inline"
            size={avatarSize}
            iconDepth={0}
            textDepth={0}
            username="Dr. kalcranstihillmanston"
            avatarUrl="https://api.dicebear.com/8.x/adventurer/svg?seed=ben"
          />
        </div>
      </header>
    </ParallaxItem>
  );
}
