import React, { createContext, useContext } from "react";

export type LightSource = {
  x: number;
  y: number;
  intensity: number;
  color: string;
};

const defaultLight: LightSource = {
  x: 0,
  y: 0,
  intensity: 0,
  color: "rgba(0,0,0,0)",
};

const LightContext = createContext<LightSource>(defaultLight);

export const ParallaxLight: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <LightContext.Provider value={defaultLight}>{children}</LightContext.Provider>
);

export const useParallaxLight = () => useContext(LightContext);
