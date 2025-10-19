import React from "react";
import "../../01-main/main.css";

interface InputTextProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function InputText({ label, error, ...props }: InputTextProps) {
  return (
    <div className="input-text-wrapper">
      {label && <label className="input-text-label">{label}</label>}
      <input className="input-text-field" {...props} />
      {error && <p className="input-text-error">{error}</p>}
    </div>
  );
}
