import React from "react";
import InputText from "../InputText/InputText";
import "../../01-main/main.css";

interface InputUsernameProps {
  label?: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  checking?: boolean;
  available?: boolean | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function InputUsername({
  label = "Username",
  value,
  disabled = false,
  required = false,
  checking = false,
  available = null,
  onChange,
}: InputUsernameProps) {
  return (
    <div className="input-username" style={{ position: "relative" }}>
      <InputText
        label={
          required ? (
            <>
              {label} <span style={{ color: "#00e0ff" }}>*</span>
            </>
          ) : (
            label
          )
        }
        placeholder="Choose a username"
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
      />

      {/* ✅ Username availability indicator */}
      {!disabled && value && (
        <span
          className="username-status"
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.85em",
            whiteSpace: "nowrap",
          }}
        >
          {checking ? (
            <span className="status checking" style={{ color: "#aaa" }}>
              Checking...
            </span>
          ) : available === true ? (
            <span className="status available" style={{ color: "#00ff99" }}>
              ✓ Available
            </span>
          ) : available === false ? (
            <span className="status taken" style={{ color: "tomato" }}>
              ✗ Taken
            </span>
          ) : null}
        </span>
      )}
    </div>
  );
}
