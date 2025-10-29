// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import CircleStack from "./components/containers/Parallax/CircleStack";
import OvalStack from "./components/containers/Parallax/OvalStack";
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
          <CircleStack top="140vh" left="30vw" color="#5f5" />
          <CircleStack top="200vh" left="70vw" color="#ff5" />

          <OvalStack top="40vh" left="70vw" color="#55f" />
          <OvalStack top="90vh" left="30vw" color="#f55" />
          <OvalStack top="120vh" left="80vw" color="#5f5" />
          <OvalStack top="200vh" left="20vw" color="#ff5" />
        </div>
      </ParallaxScene>
    </ParallaxLight>
  );
}
