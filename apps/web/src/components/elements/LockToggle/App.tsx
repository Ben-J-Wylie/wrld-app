// @ts-nocheck

import React from "react";
import LockToggle from "./components/elements/LockToggle/LockToggle";
import "./components/_main/main.css";

export default function App() {
  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background, #222)",
      }}
    >
      <LockToggle />
    </div>
  );
}
