import React, { useState } from "react";
import lockedIcon from "./locked.svg";
import unlockedIcon from "./unlocked.svg";
import "./LockToggle.css";

export default function LockToggle() {
  const [isLive, setIsLive] = useState(false);
  const [isLocked, setIsLocked] = useState(true);

  const handleToggle = () => {
    if (!isLocked) setIsLive(!isLive);
  };

  return (
    <div className={`lock-toggle ${isLive ? "on" : "off"}`}>
      {/* Lock on the left when OFF, right when ON */}
      <div
        className={`lock-icon ${isLive ? "right" : "left"}`}
        onClick={() => setIsLocked(!isLocked)}
      >
        <img src={isLocked ? lockedIcon : unlockedIcon} alt="lock icon" />
      </div>

      {/* Main slider */}
      <div
        className={`toggle-slider ${isLive ? "on" : "off"}`}
        onClick={handleToggle}
      >
        <div className="slider-trough">
          <div className="slider-thumb">
            <span className="slider-text">{isLive ? "LIVE" : "NOT LIVE"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
