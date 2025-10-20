import React from "react";
import "../../_main/main.css";

interface FeatureCardProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
}

export default function FeatureCard({
  icon,
  label,
  active,
  onClick,
  preview,
}: FeatureCardProps) {
  return (
    <div className={`feature-card ${active ? "active" : ""}`}>
      <button
        className={`toggle-button ${active ? "active" : ""}`}
        onClick={onClick}
      >
        <span className="toggle-icon">{icon}</span>
        <span className="toggle-label">{label}</span>
      </button>

      {active && preview && <div className="feature-preview">{preview}</div>}
    </div>
  );
}
