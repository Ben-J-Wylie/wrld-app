import React, { useEffect } from "react";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import "../../_main/main.css";

interface MenuProps {
  isOpen: boolean;
  side?: "menu-left" | "menu-right" | "menu-top" | "menu-bottom";
  onClose?: () => void;
  depth?: number;
  span?: number | string;
  offset?: number | string;
  children: React.ReactNode;
}

export default function Menu({
  isOpen,
  side = "menu-right",
  onClose,
  depth = 0,
  span = "100%",
  offset = "0%",
  children,
}: MenuProps) {
  const { parallaxStrength } = useResponsiveContext();

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const isHorizontal = side === "menu-top" || side === "menu-bottom";
  const spanValue = typeof span === "number" ? `${span}px` : span;
  const offsetValue = typeof offset === "number" ? `${offset}px` : offset;
  const isFullSpan = spanValue === "100%";

  // --- Edge anchoring & span ---
  let containerStyle: React.CSSProperties = {};
  if (isHorizontal) {
    // Top/Bottom spans width
    containerStyle = isFullSpan
      ? {
          left: 0,
          right: 0,
          ...(side === "menu-top" ? { top: 0 } : { bottom: 0 }),
        }
      : {
          width: spanValue,
          left: "50%",
          ...(side === "menu-top" ? { top: 0 } : { bottom: 0 }),
        };
  } else {
    // Left/Right spans height
    containerStyle = isFullSpan
      ? {
          top: 0,
          bottom: 0,
          ...(side === "menu-left" ? { left: 0 } : { right: 0 }),
        }
      : {
          height: spanValue,
          top: "50%",
          ...(side === "menu-left" ? { left: 0 } : { right: 0 }),
        };
  }

  // --- Cross-axis centering/offset (NO scale) ---
  const transformStyle: React.CSSProperties = isHorizontal
    ? // For top/bottom, adjust vertically (cross-axis)
      isFullSpan
      ? { transform: `translateY(${offsetValue})` }
      : { transform: `translate(-50%, ${offsetValue})` }
    : // For left/right, adjust horizontally (cross-axis)
    isFullSpan
    ? { transform: `translateX(${offsetValue})` }
    : { transform: `translate(${offsetValue}, -50%)` };

  const layoutDirection = isHorizontal ? "row" : "column";

  return (
    <ParallaxItem
      fixed
      depth={depth}
      strength={parallaxStrength * 25}
      style={{ zIndex: 999, position: "fixed", ...containerStyle }}
    >
      <div
        className={`menu ${side} ${isOpen ? "open" : "closed"}`}
        role="menu"
        style={{
          ...transformStyle,
          display: "flex",
          flexDirection: layoutDirection,
          justifyContent: "center",
          alignItems: "center",
          width: isHorizontal ? "100%" : "auto",
          height: isHorizontal ? "auto" : "100%",
        }}
      >
        <div className="menu-content">{children}</div>
      </div>
    </ParallaxItem>
  );
}
