// @ts-nocheck

import React, { useState } from "react";
import PreviewCamera from "./components/manifolds/PreviewCamera/PreviewCamera";

export default function App() {
  const [facing, setFacing] = useState<"user" | "environment">("user");

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
      <h2 style={{ fontWeight: 500 }}>Camera Preview Demo</h2>

      <div style={{ width: "80%", maxWidth: "400px" }}>
        <PreviewCamera facing={facing} />
      </div>

      <button
        onClick={() =>
          setFacing((prev) => (prev === "user" ? "environment" : "user"))
        }
        style={{
          background: "#00e0ff",
          border: "none",
          color: "#000",
          padding: "10px 20px",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Switch Camera ({facing})
      </button>
    </div>
  );
}
