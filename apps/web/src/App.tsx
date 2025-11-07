// App.tsx
import React, { useEffect } from "react";
import NestedToggle from "./components/elements/NestedToggle/NestedToggle";
import { toggleRegistry } from "./components/elements/NestedToggle/ToggleRegistry";
import { toggleFamilyConfig } from "./components/elements/NestedToggle/toggleConfig";

export default function App() {
  useEffect(() => {
    // initialize the registry
    Object.values(toggleFamilyConfig).forEach((node) => {
      toggleRegistry.register(node);
    });
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        background: "var(--color-background, #1a1a1a)",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ color: "white" }}>Global Family Toggle Demo</h2>

      <NestedToggle id="parent" />

      <div style={{ display: "flex", gap: "16px" }}>
        <NestedToggle id="child1" />
        <NestedToggle id="child2" />
      </div>

      <NestedToggle id="grandchild" />
    </div>
  );
}
