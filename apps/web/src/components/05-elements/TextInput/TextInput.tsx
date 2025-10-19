import React from "react";
import "../../01-main/main.css";

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function TextInput({ label, error, ...props }: TextInputProps) {
  return (
    <div className="text-input-wrapper">
      {label && <label className="text-input-label">{label}</label>}
      <input className="text-input-field" {...props} />
      {error && <p className="text-input-error">{error}</p>}
    </div>
  );
}
