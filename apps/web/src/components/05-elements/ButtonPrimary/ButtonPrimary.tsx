import React from "react";
import "../../01-main/main.css";

interface ButtonPrimaryProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function ButtonPrimary({
  loading,
  children,
  ...props
}: ButtonPrimaryProps) {
  return (
    <button
      className="button-primary"
      {...props}
      disabled={loading || props.disabled}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
