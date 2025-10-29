// @ts-nocheck

import React from "react";
import { ParallaxScene } from "./components/containers/Parallax/ParallaxScene";
import CircleStack from "./components/containers/Parallax/CircleStack";
import OvalStack from "./components/containers/Parallax/OvalStack";
import { ParallaxLight } from "./components/containers/Parallax/ParallaxLight";
import {
  ParallaxDepthController,
  useParallaxDepth,
} from "./components/containers/Parallax/ParallaxDepthController";

/** 🔧 Live controller for testing focal depth */
const DepthSlider: React.FC = () => {
  const { focalDepth, setFocalDepth } = useParallaxDepth();
  return (
    <div
      style={{
        position: "fixed",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#fff9",
        color: "#000",
        padding: "8px 16px",
        borderRadius: "8px",
        fontFamily: "sans-serif",
        zIndex: 1,
        backdropFilter: "blur(6px)",
      }}
    >
      <label>
        Focal Depth: {focalDepth.toFixed(2)}
        <input
          type="range"
          min={-2}
          max={5}
          step={0.1}
          value={focalDepth}
          onChange={(e) => setFocalDepth(parseFloat(e.target.value))}
          style={{ marginLeft: "10px", width: "200px" }}
        />
      </label>
    </div>
  );
};

export default function App() {
  return (
    <ParallaxLight>
      <ParallaxDepthController>
        <ParallaxScene>
          <DepthSlider /> {/* 🟢 focal depth controller */}
          <div
            style={{
              position: "relative",
              width: "100vw",
              minHeight: "300vh",
              background: "#dadadaff",
              fontFamily: "sans-serif",
              color: "#fff",
              overflow: "hidden",
            }}
          >
            <CircleStack top="40vh" left="10vw" color="#55f" />
            <CircleStack top="80vh" left="60vw" color="#f55" />
            <CircleStack top="140vh" left="30vw" color="#5f5" />
            <CircleStack top="200vh" left="70vw" color="#ff5" />

            <OvalStack top="40vh" left="70vw" color="#55f" />
            <OvalStack top="90vh" left="30vw" color="#f55" />
            <OvalStack top="120vh" left="80vw" color="#5f5" />
            <OvalStack top="200vh" left="20vw" color="#ff5" />

            <CircleStack top="50vh" left="50vw" color="yellow" />
          </div>
        </ParallaxScene>
      </ParallaxDepthController>
    </ParallaxLight>
  );
}
