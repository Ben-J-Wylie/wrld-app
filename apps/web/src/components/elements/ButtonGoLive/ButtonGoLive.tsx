import React from "react";
import { Power } from "lucide-react";
import "../../01-main/main.css";

interface ButtonGoLiveProps {
  isLive: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export default function ButtonGoLive({
  isLive,
  disabled = false,
  onClick,
}: ButtonGoLiveProps) {
  return (
    <button
      className={`go-live-button ${isLive ? "active" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Power className="icon" size={18} />
      {isLive ? "End Stream" : "Go Live"}
    </button>
  );
}
