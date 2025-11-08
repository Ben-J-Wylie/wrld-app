import React from "react";
import "../../_main/main.css";
import { useToggleNode } from "./useToggleNode";
import { ToggleState } from "./ToggleTypes";
import "./NestedToggle.css";

interface NestedToggleProps {
  id: string;
}

export default function NestedToggle({ id }: NestedToggleProps) {
  const { state, label, setState, ancestors } = useToggleNode(id);

  const handleClick = () => {
    let newState: ToggleState;
    switch (state) {
      case "on":
      case "cued":
        newState = "off";
        break;
      default:
        newState = "on";
        break;
    }
    setState(newState);
  };

  const text = state === "on" ? "LIVE" : state === "cued" ? "CUED" : "OFF";
  const generation = ancestors.length + 1;

  return (
    <div className="toggle-wrapper" onClick={handleClick}>
      <div className={`toggle-slider ${state}`}>
        <div className="toggle-trough">
          <div className="toggle-thumb">
            <span className="toggle-text">{text}</span>
          </div>
        </div>
      </div>

      <div className="toggle-circles">
        {[...ancestors, state].slice(-generation).map((s, i) => (
          <div
            key={i}
            className={`circle circle-${s} ${
              i === generation - 1 ? "self" : "ancestor"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
