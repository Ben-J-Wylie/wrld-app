// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import CircleStack from "./components/containers/Parallax/CircleStack";
export default function App() {
  return (
    <ParallaxScene>
      <div
        style={{
          minHeight: "300vh",
          background: "#0e0e0e",
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

        {/* Several stacks in different positions */}
        <CircleStack top="40vh" left="10vw" strength={20} color="#55f" />
        <CircleStack top="80vh" left="60vw" strength={20} color="#f55" />
        <CircleStack top="140vh" left="30vw" strength={20} color="#5f5" />
        <CircleStack top="200vh" left="70vw" strength={20} color="#ff5" />

        <div style={{ height: "100vh" }} />
      </div>
    </ParallaxScene>
  );
}
