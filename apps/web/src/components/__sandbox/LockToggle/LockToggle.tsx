import React, { useState } from "react";
import "./LockToggle.css";
import lockedIcon from "../../elements/LockToggle/locked.svg";
import unlockedIcon from "../../elements/LockToggle/unlocked.svg";

export default function LockToggle() {
  const [isLocked, setIsLocked] = useState(false);

  return (
    <div
      className={`lock-toggle ${isLocked ? "on" : "off"}`}
      onClick={() => setIsLocked(!isLocked)}
    >
      <div className="lock-border">
        <img
          src={isLocked ? lockedIcon : unlockedIcon}
          alt={isLocked ? "Locked" : "Unlocked"}
          className="lock-icon"
        />
      </div>
    </div>
  );
}
