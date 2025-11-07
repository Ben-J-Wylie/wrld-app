import React, { useState } from "react";
import NestedToggle, {
  ToggleState,
} from "./components/elements/NestedToggle/NestedToggle";
import "./components/_main/main.css";

export default function App() {
  const [globalState, setGlobalState] = useState<ToggleState>("on");
  const [child1State, setChild1State] = useState<ToggleState>("off");
  const [child2State, setChild2State] = useState<ToggleState>("on");
  const [grandChildState, setGrandChildState] = useState<ToggleState>("off");

  const effectiveChild1 =
    globalState === "off" && child1State === "on" ? "cued" : child1State;
  const effectiveChild2 =
    globalState === "off" && child2State === "on" ? "cued" : child2State;
  const effectiveGrandChild =
    (globalState === "off" || child2State === "off") && grandChildState === "on"
      ? "cued"
      : grandChildState;

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
      <h2 style={{ color: "white" }}>Nested Dependency Toggle Demo</h2>

      <NestedToggle
        label="PARENT"
        initialState={globalState}
        onStateChange={setGlobalState}
      />

      <div style={{ display: "flex", gap: "16px" }}>
        <NestedToggle
          label="CHILD 1"
          initialState={child1State}
          parentState={globalState}
          onStateChange={setChild1State}
        />
        <NestedToggle
          label="CHILD 2"
          initialState={child2State}
          parentState={globalState}
          onStateChange={setChild2State}
        />
      </div>

      <NestedToggle
        label="GRANDCHILD"
        initialState={grandChildState}
        parentState={effectiveChild2}
        onStateChange={setGrandChildState}
      />

      <div style={{ color: "#bbb", marginTop: "24px", fontSize: "0.85rem" }}>
        <p>Parent: {globalState}</p>
        <p>Child 1: {effectiveChild1}</p>
        <p>Child 2: {effectiveChild2}</p>
        <p>Grandchild: {effectiveGrandChild}</p>
      </div>
    </div>
  );
}
