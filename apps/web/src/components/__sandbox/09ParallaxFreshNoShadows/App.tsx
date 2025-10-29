// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import CircleStack from "./components/containers/Parallax/CircleStack";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";

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
          {/* ... all your parallax stacks ... */}
          <CircleStack top="40vh" left="10vw" color="#55f" />
          <CircleStack top="80vh" left="60vw" color="#f55" />
          <CircleStack top="140vh" left="50vw" color="#5f5" />
          <CircleStack top="200vh" left="70vw" color="#ff5" />
        </div>
      </ParallaxScene>
    </ParallaxLight>
  );
}
