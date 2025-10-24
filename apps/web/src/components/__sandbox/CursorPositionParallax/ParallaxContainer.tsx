import React from "react";

export const ParallaxContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "relative",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      perspective: "1000px",
      background: "radial-gradient(circle at center, #111 0%, #000 100%)",
    }}
  >
    {children}
  </div>
);
