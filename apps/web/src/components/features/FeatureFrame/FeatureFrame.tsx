import React from "react";
import "./FeatureFrame.css";

interface FeatureFrameProps {
  depth?: number;
  label?: string;
  children?: React.ReactNode;
}

export default function FeatureFrame({
  depth = 0,
  label,
  children,
}: FeatureFrameProps) {
  return (
    <div
      className="feature-frame"
      style={{
        transform: `translateZ(${depth * 10}px)`,
      }}
    >
      {/* Structural outline */}
      <svg
        className="feature-structure"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <rect x="1" y="1" width="98" height="98" className="outline" />
        <line x1="50" y1="0" x2="50" y2="100" className="grid-line" />
        <line x1="0" y1="50" x2="100" y2="50" className="grid-line" />
      </svg>

      {/* Content core */}
      <div className="feature-content">{children}</div>

      {/* Label */}
      {label && <div className="feature-label">{label}</div>}
    </div>
  );
}
