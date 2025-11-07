import React, { useState, useEffect } from "react";
import "../../_main/main.css";

export type ToggleState = "on" | "off" | "cued";

interface NestedToggleProps {
  label?: string;
  parentState?: ToggleState;
  initialState?: ToggleState;
  onStateChange?: (state: ToggleState) => void;
  generation?: number; // 1 = parent, 2 = child, 3 = grandchild, etc.
  ancestorStates?: ToggleState[]; // used for nested visual chain
}

export default function NestedToggle({
  label = "LIVE",
  parentState = "on",
  initialState = "off",
  onStateChange,
  generation = 1,
  ancestorStates = [],
}: NestedToggleProps) {
  const [position, setPosition] = useState<"on" | "off">(
    initialState === "on" ? "on" : "off"
  );
  const [displayState, setDisplayState] = useState<ToggleState>(initialState);

  useEffect(() => {
    if (parentState === "off" && position === "on") setDisplayState("cued");
    else if (parentState === "cued" && position === "on")
      setDisplayState("cued");
    else setDisplayState(position);
  }, [parentState, position]);

  const handleClick = () => {
    const newPosition = position === "off" ? "on" : "off";
    setPosition(newPosition);
    onStateChange?.(newPosition);
  };

  const text =
    displayState === "on" ? label : displayState === "cued" ? "CUED" : "OFF";

  // Combine ancestor states with current one to visualize all generations
  const circles = [...ancestorStates, displayState].slice(-generation);

  return (
    <div className="toggle-wrapper">
      <div
        className={`toggle-slider ${displayState}`}
        onClick={handleClick}
        title={`${label}: ${displayState.toUpperCase()}`}
      >
        <div className="toggle-trough">
          <div className="toggle-thumb">
            <span className="toggle-text">{text}</span>
          </div>
        </div>
      </div>

      {/* Circles row */}
      <div className="toggle-circles">
        {circles.map((state, i) => (
          <div
            key={i}
            className={`circle circle-${state} ${
              i === circles.length - 1 ? "self" : "ancestor"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
