import React, { useState } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import WrldLogo from "../../Elements/Logo/Logo";
import Avatar from "../../Elements/Avatar/Avatar";
import MenuContainer from "../../Elements/Menu/MenuContainer";
import MenuEntry from "../../Elements/Menu/MenuEntry";
import "./Header.css";

interface HeaderProps {
  depth?: number;
}

export default function Header({ depth = 0 }: HeaderProps) {
  const { scale, device } = useResponsiveContext();
  const [menuTopOpen, setMenuTopOpen] = useState(false);

  // 🔹 Responsive sizing
  const headerHeight = 100 * scale;
  const logoSize = 100; // base size
  const avatarSize = 60;

  // 🔹 Layout spacing
  const paddingX = device === "mobile" ? 16 : 32;
  const paddingY = device === "mobile" ? 8 : 16;

  const toggleTopMenu = () => setMenuTopOpen((prev) => !prev);

  return (
    <>
      {/* Fixed Header */}
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

          {/* Right: Avatar (clickable) */}
          <div
            className="header-right"
            style={{ cursor: "pointer" }}
            onClick={toggleTopMenu}
          >
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

      {/* Top Menu */}
      <MenuContainer
        isOpen={menuTopOpen}
        side="menu-top"
        depth={0}
        span="20%"
        encroach="50%"
        offset="35%"
        startOffset={`${headerHeight}px`} // 👈 now works correctly
      >
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
        <MenuEntry label="Profile" depth={0.1} />
        <MenuEntry label="Settings" depth={0.1} />
        <MenuEntry label="Help" depth={0.1} />
        <MenuEntry label="Sign Out" depth={0.1} />
      </MenuContainer>
    </>
  );
}
