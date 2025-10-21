import React from "react";
import "../../_main/main.css";

interface FormContainerProps {
  children: React.ReactNode;
  maxWidth?: string;
  centered?: boolean;
}

export default function FormContainer({
  children,
  maxWidth = "320px",
  centered = true,
}: FormContainerProps) {
  return (
    <div
      className="form-container"
      style={{
        maxWidth,
        margin: centered ? "0 auto" : undefined,
      }}
    >
      {children}
    </div>
  );
}
