import React from "react";
import ParallaxItem from "./ParallaxItem";

/**
 * Full-screen parallax plane at depth 0.
 * Acts as a universal receiver for shadows.
 */
const ParallaxBackground: React.FC = () => {
  return (
    <ParallaxItem depth={0} style={{ top: 0, left: 0 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100vw",
          height: "300vh", // extend if your scene scrolls farther
          background: "#dadadaff", // same color as your scene bg
        }}
      />
    </ParallaxItem>
  );
};

export default ParallaxBackground;
