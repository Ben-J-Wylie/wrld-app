import React from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import WrldLogo from "../../elements/Logo/Logo";
import "./Header.css";

export default function Header() {
  const { scale, device } = useResponsiveContext();

  // 🔹 Basic responsive sizing
  const headerHeight = 100 * scale;
  const logoSize = 100; // base size; logo handles its own scale internally

  // 🔹 Example spacing or layout variation
  const paddingX = device === "mobile" ? 16 : 32;
  const paddingY = device === "mobile" ? 8 : 16;

  return (
    <header
      className="header"
      style={{
        height: `${headerHeight}px`,
        padding: `${paddingY}px ${paddingX}px`,
      }}
    >
      <div className="header-left">
        <WrldLogo layout="inline" iconDepth={0} textDepth={1} size={logoSize} />
      </div>

      <div className="header-right">
        <nav className="nav">
          <a href="#">Home</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </nav>
      </div>
    </header>
  );
}
