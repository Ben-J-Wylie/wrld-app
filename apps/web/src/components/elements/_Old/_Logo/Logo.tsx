import React from "react";
import "../../_main/main.css";

interface LogoProps {
  text?: string;
  size?: number; // font size in pixels
  variant?: "light" | "dark" | "accent"; // color style
  onClick?: () => void;
}

export default function Logo({
  text = "WRLD",
  size = 36,
  variant = "light",
  onClick,
}: LogoProps) {
  return (
    <div
      className={`logo ${variant}`}
      style={{ fontSize: `${size}px` }}
      onClick={onClick}
    >
      <span className="logo-main">{text}</span>
      <span className="logo-dot">•</span>
    </div>
  );
}
