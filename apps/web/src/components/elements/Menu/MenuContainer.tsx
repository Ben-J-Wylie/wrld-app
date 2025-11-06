import React, { useEffect, useRef, useState } from "react";
import ParallaxItem from "../../containers/Parallax/ParallaxItem";
import { useResponsiveContext } from "../../containers/Responsive/ResponsiveContext";
import "./MenuContainer.css";

interface MenuProps {
  isOpen: boolean;
  side?: "menu-left" | "menu-right" | "menu-top" | "menu-bottom";
  onClose?: () => void;
  depth?: number;
  span?: number | string;
  offset?: number | string;
  encroach?: number | string;
  startOffset?: number | string;
  children: React.ReactNode;
}

export default function MenuContainer({
  isOpen,
  side = "menu-right",
  onClose,
  depth = 0,
  span = "100%",
  offset = "0%",
  encroach = "25%",
  startOffset = 0,
  children,
}: MenuProps) {
  const { scale, width, height } = useResponsiveContext();
  const [visible, setVisible] = useState(isOpen);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 1) Ensure the node exists when opening (breaks the chicken-and-egg)
  useEffect(() => {
    if (isOpen) setVisible(true);
  }, [isOpen]);

  // 2) Toggle classes and handle transition end on the mounted node
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // start transition on next frame so styles are applied
    if (isOpen) {
      requestAnimationFrame(() => {
        el.classList.add("open");
        el.classList.remove("closed");
      });
    } else {
      el.classList.add("closed");
      el.classList.remove("open");
    }

    const handleEnd = (e: TransitionEvent) => {
      // Only react to transform/opacity (the ones we transition)
      if (e.target !== el) return;
      if (e.propertyName !== "opacity" && e.propertyName !== "transform")
        return;

      if (!isOpen) {
        setVisible(false); // hide only after close animation actually finishes
      }
      // Let the parallax system re-measure at the exact end of the transition
      window.dispatchEvent(new Event("menuReflow"));
    };

    el.addEventListener("transitionend", handleEnd);
    return () => el.removeEventListener("transitionend", handleEnd);
  }, [isOpen, side, visible]);

  if (!width || !height) return null;

  // Layout
  const baseStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 90,
    overflow: "hidden",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const getViewportOffset = (axis: "X" | "Y") => {
    const dimension = axis === "X" ? width : height;
    if (typeof offset === "string" && offset.includes("%")) {
      return (parseFloat(offset) / 100) * dimension;
    }
    return Number(offset) || 0;
  };

  let layoutStyle: React.CSSProperties = {};
  switch (side) {
    case "menu-left":
    case "menu-right": {
      const horizontalPosition =
        side === "menu-left" ? { left: 0 } : { right: 0 };
      layoutStyle = {
        ...baseStyle,
        ...horizontalPosition,
        top: "50%",
        height: span,
        width: encroach,
        transform: `translateY(-50%) translateY(${getViewportOffset("Y")}px)`,
      };
      break;
    }
    case "menu-top":
    case "menu-bottom": {
      const verticalPosition =
        side === "menu-top"
          ? { top: startOffset ?? 0 }
          : { bottom: startOffset ?? 0 };
      layoutStyle = {
        ...baseStyle,
        ...verticalPosition,
        left: "50%",
        width: span,
        height: encroach,
        transform: `translateX(-50%) translateX(${getViewportOffset("X")}px)`,
      };
      break;
    }
  }

  return (
    visible && (
      <ParallaxItem depth={depth} fixed style={layoutStyle}>
        <div
          ref={containerRef}
          className={`menu-container ${side} closed`}
          // ^ start "closed"; effect will switch to "open" on next frame if isOpen
          style={{ borderRadius: `${12 * scale}px` }}
        >
          {children}
        </div>
      </ParallaxItem>
    )
  );
}
