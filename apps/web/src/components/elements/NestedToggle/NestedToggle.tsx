import React, { useState, useEffect } from "react";
import "../../_main/main.css";

export type ToggleState = "on" | "off" | "cued";

interface NestedToggleProps {
  label?: string;
  parentState?: ToggleState;
  initialState?: ToggleState;
  onStateChange?: (state: ToggleState) => void;
}

export default function NestedToggle({
  label = "LIVE",
  parentState = "on",
  initialState = "off",
  onStateChange,
}: NestedToggleProps) {
  const [position, setPosition] = useState<"on" | "off">(
    initialState === "on" ? "on" : "off"
  );
  const [displayState, setDisplayState] = useState<ToggleState>(initialState);

  // === Determine visual state based on parent hierarchy ===
  useEffect(() => {
    if (parentState === "off" && position === "on") {
      setDisplayState("cued");
    } else if (parentState === "cued" && position === "on") {
      setDisplayState("cued");
    } else {
      setDisplayState(position);
    }
  }, [parentState, position]);

  const handleClick = () => {
    const newPosition = position === "off" ? "on" : "off";
    setPosition(newPosition);
    onStateChange?.(newPosition);
  };

  const text =
    displayState === "on"
      ? label
      : displayState === "cued"
      ? `${label} (CUED)`
      : `NOT ${label}`;

  return (
    <div
      className={`toggle-slider ${displayState}`}
      onClick={handleClick}
      title={`${label}: ${displayState.toUpperCase()}`}
    >
      <div className="slider-trough">
        <div className="slider-thumb">
          <span className="slider-text">{text}</span>
        </div>
      </div>
    </div>
  );
}
