// @ts-nocheck

import React from "react";
import PreviewGyro from "./components/features/PreviewGyro/PreviewGyro";

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
      <h2 style={{ fontWeight: 500 }}>Gyroscope Preview Demo</h2>

      <div style={{ width: "80%", maxWidth: "400px" }}>
        <PreviewGyro />
      </div>

      <p style={{ color: "#777", fontSize: "0.9rem", textAlign: "center" }}>
        Move or rotate your device to see live orientation values. On iOS, tap
        “Enable Motion Access” to grant permission.
      </p>
    </div>
  );
}
