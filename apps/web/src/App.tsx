// apps/web/src/App.tsx
import React from "react";
import "./App.css";

export default function App() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background:
          "radial-gradient(circle at 50% 20%, #0f2027, #203a43, #2c5364)",
        color: "white",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>
        🌐 Welcome to WRLD
      </h1>
      <p style={{ fontSize: "1.25rem", opacity: 0.85 }}>
        Your livestreaming universe starts here.
      </p>
      <p style={{ marginTop: "2rem", fontSize: "0.9rem", opacity: 0.6 }}>
        Built with React + Vite + Turborepo
      </p>
    </div>
  );
}
