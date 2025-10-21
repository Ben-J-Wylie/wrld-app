// @ts-nocheck

import React from "react";
import PreviewScreenShare from "./components/features/PreviewScreenShare/PreviewScreenShare";

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
      <h2 style={{ fontWeight: 500 }}>Screen Share Preview Demo</h2>

      <div style={{ width: "80%", maxWidth: "500px" }}>
        <PreviewScreenShare />
      </div>

      <p style={{ color: "#777", fontSize: "0.9rem", textAlign: "center" }}>
        Click “Start Screen Share” and select a window or screen. The preview
        will appear below.
      </p>
    </div>
  );
}
