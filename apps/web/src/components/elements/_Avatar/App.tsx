// @ts-nocheck

import React from "react";
import { ResponsiveProvider } from "./components/containers/Responsive/ResponsiveContext";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import DebugOverlay from "./components/containers/DebugOverlay";
import Avatar from "./components/elements/Avatar/Avatar";
import "./components/_main/main.css";

export default function App() {
  const showDebug = true; // 🔹 toggle debug overlay

  return (
    <ResponsiveProvider>
      <ParallaxLight>
        <ParallaxScene>
          {/* Scrollable space */}
          <div
            style={{
              height: "200vh",
              width: "100vw",
              overflow: "scroll",
            }}
          ></div>

          {/* Inline Avatar */}
          <div
            style={{
              position: "absolute",
              top: "30%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <DebugOverlay show={showDebug}>
              <Avatar
                avatarUrl="https://api.dicebear.com/8.x/adventurer/svg?seed=ben"
                username="Ben"
                layout="inline"
                size={200}
                iconDepth={0}
                textDepth={0}
              />
            </DebugOverlay>
          </div>

          {/* Stacked Avatar */}
          <div
            style={{
              position: "absolute",
              top: "70%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <DebugOverlay show={showDebug}>
              <Avatar
                username="Alice"
                layout="stacked"
                size={200}
                iconDepth={0}
                textDepth={0}
              />
            </DebugOverlay>
          </div>
        </ParallaxScene>
      </ParallaxLight>
    </ResponsiveProvider>
  );
}
