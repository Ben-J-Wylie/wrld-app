import React from "react";
import { ParallaxContainer } from "./ParallaxContainer";
import { ParallaxLayer } from "./ParallaxLayer";

export const ParallaxText: React.FC = () => {
  return (
    <ParallaxContainer>
      <ParallaxLayer depth={-2} style={{ color: "#333", fontSize: "8rem" }}>
        WRLD
      </ParallaxLayer>
      <ParallaxLayer depth={-1} style={{ color: "#555", fontSize: "6rem" }}>
        WRLD
      </ParallaxLayer>
      <ParallaxLayer depth={0} style={{ color: "#999", fontSize: "4rem" }}>
        WRLD
      </ParallaxLayer>
      <ParallaxLayer depth={1} style={{ color: "#fff", fontSize: "2rem" }}>
        WRLD
      </ParallaxLayer>
    </ParallaxContainer>
  );
};
