// @ts-nocheck

import React, { useState } from "react";
import PreviewMicFFT from "./components/features/PreviewMicFFT/PreviewMicFFT";

export default function App() {
  const [visible, setVisible] = useState(false);

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
      <h2 style={{ fontWeight: 500 }}>Microphone FFT Preview</h2>

      <button
        onClick={() => setVisible((v) => !v)}
        style={{
          background: visible ? "#ff0066" : "#00e0ff",
          color: "#000",
          padding: "10px 20px",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        {visible ? "Stop Mic" : "Start Mic"}
      </button>

      {visible && <PreviewMicFFT />}
    </div>
  );
}
