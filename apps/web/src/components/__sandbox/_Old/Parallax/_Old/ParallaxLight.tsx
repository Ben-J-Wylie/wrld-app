import React, { createContext, useContext } from "react";

export type LightSource = {
  x: number; // horizontal direction (-1 = from left, +1 = from right)
  y: number; // vertical direction (-1 = from top, +1 = from bottom)
  intensity: number; // 0–1 overall multiplier
  color: string; // rgba or hsla color for shadow
};

// Global default light (static)
const defaultLight: LightSource = {
  x: -1,
  y: -1,
  intensity: 1,
  color: "rgba(0, 0, 0, 0)",
};

// Context with the default light
const LightContext = createContext<LightSource>(defaultLight);

/**
 * Static global light provider for the parallax system.
 * Every ParallaxItem will use this single light definition.
 */
export const ParallaxLight: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <LightContext.Provider value={defaultLight}>
      {children}
    </LightContext.Provider>
  );
};

/** Hook for ParallaxItem and others to read the light data */
export const useParallaxLight = () => useContext(LightContext);
