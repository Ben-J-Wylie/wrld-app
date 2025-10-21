import React from "react";
import "../../_main/main.css";

interface FormFooterProps {
  children: React.ReactNode;
}

export default function FormFooter({ children }: FormFooterProps) {
  return <div className="form-footer">{children}</div>;
}
