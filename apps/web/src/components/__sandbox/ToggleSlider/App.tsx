// @ts-nocheck

import React from "react";
import ToggleSlider from "./components/elements/ToggleSlider/ToggleSlider";
import "./components/_main/main.css";

export default function App() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background, #222)",
      }}
    >
      <ToggleSlider />
    </div>
  );
}
