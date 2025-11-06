import React, { useState } from "react";
import "./ToggleSlider.css";

export default function ToggleSlider() {
  const [isOn, setIsOn] = useState(false);

  return (
    <div
      className={`toggle-slider ${isOn ? "on" : "off"}`}
      onClick={() => setIsOn(!isOn)}
    >
      <div className="slider-trough">
        <div className="slider-thumb">
          <span className="slider-text">{isOn ? "LIVE" : "NOT LIVE"}</span>
        </div>
      </div>
    </div>
  );
}
