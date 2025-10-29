import React, { createContext, useContext } from "react";

export type LightSource = {
  x: number; // horizontal direction (-1 left, +1 right)
  y: number; // vertical direction (-1 up, +1 down)
  intensity: number; // 0–1 overall multiplier
  color: string; // rgba or hsla color for shadow
};

const LightContext = createContext<LightSource>({
  x: 1,
  y: 1,
  intensity: 1,
  color: "rgba(0, 0, 0, 0)",
});

export const ParallaxLight: React.FC<{
  light?: Partial<LightSource>;
  children: React.ReactNode;
}> = ({ light = {}, children }) => {
  // Merge provided props with defaults
  const merged: LightSource = { ...useContext(LightContext), ...light };
  return (
    <LightContext.Provider value={merged}>{children}</LightContext.Provider>
  );
};

// Hook for child components
export const useParallaxLight = () => useContext(LightContext);
