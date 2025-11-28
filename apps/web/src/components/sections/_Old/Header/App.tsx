// @ts-nocheck

import React from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import WrldLogo from "./components/elements/Logo/Logo";
import DebugOverlay from "./components/containers/DebugOverlay";
import Header from "./components/sections/Header/Header";
import "./components/_main/main.css";

export default function App() {
  const showDebug = false;

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          {/* 🔹 Fixed Header with depth-aware lighting */}
          <Header depth={0.2} />

          {/* 🔹 Scrollable space below */}
          <div
            style={{
              height: "200vh",
              width: "100vw",
              position: "relative",
            }}
          >
            {/* Centered WrldLogo to show parallax movement */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <DebugOverlay show={showDebug}>
                <WrldLogo
                  layout="inline"
                  size={150}
                  iconDepth={0}
                  textDepth={0}
                />
              </DebugOverlay>
            </div>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
