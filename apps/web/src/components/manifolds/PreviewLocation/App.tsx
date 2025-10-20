// @ts-nocheck

import React from "react";
import PreviewLocation from "./components/manifolds/PreviewLocation/PreviewLocation";

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
      <h2 style={{ fontWeight: 500 }}>Location Preview Demo</h2>
      <div style={{ width: "80%", maxWidth: "500px" }}>
        <PreviewLocation />
      </div>
      <p style={{ color: "#777", fontSize: "0.9rem", textAlign: "center" }}>
        Click the expand icon (⤢) to enlarge the map. It will track your real
        location if permission is granted.
      </p>
    </div>
  );
}
