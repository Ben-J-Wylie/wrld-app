import React from "react";

type DebugOverlayProps = {
  show?: boolean;
  color?: string;
  label?: string;
  width?: number | string;
  height?: number | string;
  children?: React.ReactNode;
};

export default function DebugOverlay({
  show = true,
  color = "rgba(0, 0, 0, 0.3)",
  label,
  width = "100%",
  height = "100%",
  children,
}: DebugOverlayProps) {
  if (!show) return <>{children}</>;

  return (
    <div
      style={{
        position: "relative",
        outline: `2px dashed ${color}`,
        width,
        height,
      }}
    >
      {label && (
        <span
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: color,
            color: "#000",
            fontSize: "0.7rem",
            padding: "2px 4px",
            borderBottomRightRadius: "4px",
            userSelect: "none",
          }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
