import React from "react";
import { ParallaxContainer } from "./ParallaxContainer";
import { ParallaxLayer } from "./ParallaxLayer";

export default function MyComponent() {
  return (
    <ParallaxContainer>
      <ParallaxLayer depth={-1}>
        <img src="/bg-stars.png" alt="stars" style={{ width: "100%" }} />
      </ParallaxLayer>

      <ParallaxLayer depth={-0.5}>
        <img src="/clouds.png" alt="clouds" style={{ width: "100%" }} />
      </ParallaxLayer>

      <ParallaxLayer depth={0.2}>
        <h1 style={{ position: "absolute", top: "40%", left: "20%" }}>
          Hello, Depth
        </h1>
      </ParallaxLayer>
    </ParallaxContainer>
  );
}
