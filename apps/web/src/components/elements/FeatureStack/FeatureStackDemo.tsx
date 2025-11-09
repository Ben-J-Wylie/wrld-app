import React from "react";
import FeatureStack from "./FeatureStack";
import Circle from "./Circle";
import Square from "./Square";
import Triangle from "./Triangle";

export default function FeatureStackDemo() {
  const debug = true; // ⬅ toggle this on/off to show guides

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
      }}
    >
      {/* === The stack === */}
      <FeatureStack
        top="00%"
        left="80%"
        size={300}
        layers={[
          {
            id: "base-square",
            Component: Square,
            depth: 0,
            color: "#3366ff",
            width: 240,
            height: 240,
            opacity: 0.8,
            offsetX: 0,
            offsetY: 0,
          },
          {
            id: "middle-triangle",
            Component: Triangle,
            depth: 0.5,
            hoverDepthShift: 0.2,
            color: "#ff6600",
            width: 200,
            height: 200,
            rotation: 15,
            offsetX: 0,
            offsetY: 0,
          },
          {
            id: "top-circle",
            Component: Circle,
            depth: 1,
            hoverDepthShift: 0.3,
            color: "#00ffaa",
            width: 150,
            height: 150,
            offsetX: 0,
            offsetY: 0,
            opacity: 0.9,
          },
        ]}
      />
    </div>
  );
}
