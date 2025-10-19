import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import "../../01-main/main.css";

interface InputPasswordProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function InputPassword({
  label,
  error,
  ...props
}: InputPasswordProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="input-password-wrapper">
      {label && <label className="input-password-label">{label}</label>}

      <div className="input-password-field-wrapper">
        <input
          className="input-password-field"
          type={showPassword ? "text" : "password"}
          {...props}
        />

        <button
          type="button"
          className="input-password-toggle"
          onClick={() => setShowPassword((prev) => !prev)}
        >
          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>

      {error && <p className="input-password-error">{error}</p>}
    </div>
  );
}
