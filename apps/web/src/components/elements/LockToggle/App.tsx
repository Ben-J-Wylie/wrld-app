// @ts-nocheck

import React from "react";
import LockToggle from "./LockToggle";
import "./LockToggle.css";

export default function App() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background, #1a1a1a)",
      }}
    >
      <LockToggle />
    </div>
  );
}
