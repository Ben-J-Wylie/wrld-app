// @ts-nocheck

import React from "react";
import ParallaxStack from "./components/containers/Parallax/ParallaxStack";

export default function App() {
  const circle1 = (
    <svg width="300" height="300" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="80" fill="#55f" opacity="0.4" />
    </svg>
  );

  const circle2 = (
    <svg width="300" height="300" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="80" fill="#55f" opacity="0.7" />
    </svg>
  );

  const circle3 = (
    <svg width="300" height="300" viewBox="0 0 300 300">
      <circle cx="150" cy="150" r="80" fill="#55f" opacity="1" />
    </svg>
  );

  return (
    <div
      style={{
        minHeight: "300vh",
        background: "#0e0e0e",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-evenly",
        fontFamily: "sans-serif",
        color: "#fff",
      }}
    >
      <h1 style={{ position: "sticky", top: 10, fontSize: "1.2rem" }}>
        Scroll to see parallax layers respond to viewport center
      </h1>

      <div style={{ marginLeft: "-500px" }}>
        <ParallaxStack
          width={300}
          height={300}
          strength={10}
          layers={[
            { depth: 0, content: circle1 },
            { depth: 1, content: circle2 },
            { depth: 2, content: circle3 },
          ]}
        />
      </div>

      <div style={{ height: "100vh" }} />
    </div>
  );
}
