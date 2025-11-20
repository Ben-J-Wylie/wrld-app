// src/App.tsx
import React from "react";
import LogoScene from "./components/elements/Logo/LogoScene";

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
      <LogoScene />
    </div>
  );
}
