import React from "react";
import "../../_main/main.css";

interface SetupHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function SetupHeader({
  title,
  subtitle,
  children,
}: SetupHeaderProps) {
  return (
    <div className="setup-header">
      {children && <div className="setup-header-actions">{children}</div>}

      <h1 className="setup-title">{title}</h1>
      {subtitle && <p className="setup-subtitle">{subtitle}</p>}
    </div>
  );
}
