import React from "react";
import "../../_main/main.css";

interface FormTitleProps {
  children: React.ReactNode;
  subtitle?: string;
}

export default function FormTitle({ children, subtitle }: FormTitleProps) {
  return (
    <div className="form-title-wrapper">
      <h2 className="form-title">{children}</h2>
      {subtitle && <p className="form-subtitle">{subtitle}</p>}
    </div>
  );
}
