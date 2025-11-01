import React from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import WrldLogo from "./components/elements/Logo/Logo";
import DebugOverlay from "./components/containers/DebugOverlay";
import "./components/_main/main.css";

export default function App() {
  const showDebug = true; // 🔹 toggle here

  return (
    <ResponsiveProvider>
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
              <WrldLogo
                layout="inline"
                iconDepth={0}
                textDepth={3}
                size={200}
              />
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
              <WrldLogo
                layout="stacked"
                iconDepth={0}
                textDepth={0.9}
                size={200}
              />
            </DebugOverlay>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
