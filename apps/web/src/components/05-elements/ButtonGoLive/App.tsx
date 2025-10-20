// @ts-nocheck

import React, { useState } from "react";
import ButtonGoLive from "./components/05-elements/ButtonGoLive/ButtonGoLive";

export default function App() {
  const [isLive, setIsLive] = useState(false);
  const [hasToggle, setHasToggle] = useState(false);

  const handleGoLive = () => {
    if (!hasToggle) return;
    setIsLive((prev) => !prev);
  };

  return (
    <div
      style={{
        background: "#0e0e0e",
        color: "#fff",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <ButtonGoLive
        isLive={isLive}
        disabled={!hasToggle}
        onClick={handleGoLive}
      />

      <div>
        <label>
          <input
            type="checkbox"
            checked={hasToggle}
            onChange={(e) => setHasToggle(e.target.checked)}
          />{" "}
          Enable Go Live
        </label>
      </div>

      <p style={{ color: "#888" }}>
        Toggle the checkbox above to enable the button.
      </p>
    </div>
  );
}
