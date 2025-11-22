// @ts-nocheck

// App.tsx
import React, { useEffect } from "react";
import NestedToggle from "./components/elements/NestedToggle/NestedToggle";
import { toggleRegistry } from "./components/elements/NestedToggle/ToggleRegistry";
import { toggleFamilyConfig } from "./components/elements/NestedToggle/toggleConfig";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";

export default function App() {
  useEffect(() => {
    // Initialize the toggle registry only once
    Object.values(toggleFamilyConfig).forEach((node) => {
      toggleRegistry.register(node);
    });
  }, []);

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          <div
            style={{
              height: "200vh", // extra scroll space to see parallax
              width: "100vw",
              position: "relative",
              background: "var(--color-background, #1a1a1a)",
              overflowX: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "32px",
              fontFamily: "sans-serif",
            }}
          >
            <h2 style={{ color: "white", marginBottom: "20px" }}>
              Global Family Toggle Demo (Parallax Enabled) More work to be done
              here with how components play with parallax item. Wrapping
              components in parallaxitem destroys them if they don't have a set
              size. Should we be defining size before or after they are wrapped?
            </h2>

            {/* 🔹 Root Toggle */}
            <NestedToggle
              id="GlobalLive"
              size={1}
              troughDepth={0.01}
              thumbDepth={0.04}
              textDepth={0.08}
              circleDepth={0.02}
              hoverDepthShift={0.01}
              style={{ marginBottom: "20px" }}
            />

            {/* 🔹 Child Toggles */}
            <div style={{ display: "flex", gap: "20px" }}>
              <NestedToggle
                id="child1"
                size={1}
                troughDepth={1}
                thumbDepth={0.2}
                textDepth={0.2}
                circleDepth={0.3}
                hoverDepthShift={0.015}
              />
              <NestedToggle
                id="child2"
                size={1}
                troughDepth={1}
                thumbDepth={0.05}
                textDepth={0.09}
                circleDepth={0.03}
                hoverDepthShift={0.015}
              />
            </div>

            {/* 🔹 Grandchild Toggle */}
            <NestedToggle
              id="grandchild"
              size={0.8}
              troughDepth={0.03}
              thumbDepth={0.06}
              textDepth={0.1}
              circleDepth={0.04}
              hoverDepthShift={0.015}
            />
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
