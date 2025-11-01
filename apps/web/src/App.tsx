import React from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import WrldLogo from "./components/elements/Logo/Logo";
import DebugOverlay from "./components/containers/DebugOverlay";
import "./components/_main/main.css";
import Header from "./components/sections/Header/Header";

export default function App() {
  const showDebug = false;

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          <Header /> {/* 👈 new header */}
          <div
            style={{
              height: "200vh",
              width: "100vw",
              position: "relative",
            }}
          >
            {/* Inline logo test */}
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              <DebugOverlay show={showDebug}>
                <WrldLogo layout="inline" iconDepth={0} textDepth={1} />
              </DebugOverlay>
            </div>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
