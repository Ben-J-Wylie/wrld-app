// @ts-nocheck

import React from "react";
import PreviewTorch from "./components/features/PreviewTorch/PreviewTorch";

export default function App() {
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
        padding: "20px",
      }}
    >
      <h2 style={{ fontWeight: 500 }}>Torch Preview Demo</h2>

      <div style={{ width: "80%", maxWidth: "500px" }}>
        <PreviewTorch />
      </div>

      <p style={{ color: "#777", fontSize: "0.9rem", textAlign: "center" }}>
        If your device supports torch control (usually mobile), you can toggle
        the flashlight and see it logged on the chart below.
      </p>
    </div>
  );
}
