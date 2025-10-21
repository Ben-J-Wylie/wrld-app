import React from "react";
import FeatureCard from "../FeatureCard/FeatureCard";
import "../../_main/main.css";

interface ToggleItem {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  preview?: React.ReactNode;
}

interface ToggleGridProps {
  items: ToggleItem[];
}

export default function ToggleGrid({ items }: ToggleGridProps) {
  return (
    <div className="toggle-grid">
      {items.map((item, i) => (
        <FeatureCard
          key={i}
          label={item.label}
          icon={item.icon}
          active={item.active}
          onClick={item.onClick}
          preview={item.preview}
        />
      ))}
    </div>
  );
}
