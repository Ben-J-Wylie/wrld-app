// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import WrldLogo from "./components/elements/Logo/Logo";
import DebugOverlay from "./components/containers/DebugOverlay";
import "./components/_main/main.css";

export default function App() {
  const showDebug = true; // 🔹 toggle here

  return (
    <ParallaxLight>
      <ParallaxScene>
        <div
          style={{
            height: "200vh",
            width: "100vw",
            overflow: "scroll",
          }}
        ></div>

        {/* Inline Logo */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <DebugOverlay show={showDebug}>
            <WrldLogo layout="inline" iconDepth={0} textDepth={1} size={100} />
          </DebugOverlay>
        </div>

        {/* Stacked Logo */}
        <div
          style={{
            position: "absolute",
            top: "60%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <DebugOverlay show={showDebug}>
            <WrldLogo layout="stacked" iconDepth={3} textDepth={2} size={180} />
          </DebugOverlay>
        </div>
      </ParallaxScene>
    </ParallaxLight>
  );
}
