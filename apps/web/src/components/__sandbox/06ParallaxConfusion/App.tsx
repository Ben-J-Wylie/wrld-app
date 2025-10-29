// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import CircleStack from "./components/containers/Parallax/CircleStack";
import OvalStack from "./components/containers/Parallax/OvalStack";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight"; // 👈 add this import

export default function App() {
  return (
    <ParallaxLight>
      <ParallaxScene>
        <div
          style={{
            minHeight: "300vh",
            background: "#dadadaff",
            position: "relative",
            fontFamily: "sans-serif",
            color: "#fff",
            overflow: "hidden",
          }}
        >
          <h1
            style={{
              position: "sticky",
              top: 10,
              textAlign: "center",
              fontSize: "1.2rem",
            }}
          >
            Scroll to see multiple parallax stacks responding to viewport center
          </h1>

          {/* Crosshair to show viewport center */}
          <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.15)",
                transform: "translateX(-0.5px)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                height: 1,
                background: "rgba(255,255,255,0.15)",
                transform: "translateY(-0.5px)",
              }}
            />
          </div>

          {/* Parallax stacks */}
          <CircleStack top="40vh" left="10vw" color="#55f" />
          <CircleStack top="80vh" left="60vw" color="#f55" />
          <CircleStack top="140vh" left="30vw" color="#5f5" />
          <CircleStack top="200vh" left="70vw" color="#ff5" />

          <OvalStack top="40vh" left="70vw" color="#55f" />
          <OvalStack top="90vh" left="30vw" color="#f55" />
          <OvalStack top="120vh" left="80vw" color="#5f5" />
          <OvalStack top="200vh" left="20vw" color="#ff5" />

          <div style={{ height: "100vh" }} />
        </div>
      </ParallaxScene>
    </ParallaxLight>
  );
}
