// src/App.tsx
import React from "react";
import BetaScene from "./scenes/BetaScene/BetaScene";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        margin: 0,
        padding: 0,
      }}
    >
      <BetaScene />
    </div>
  );
}
