import React, { createContext, useContext, useState } from "react";

/**
 * Controls the "reference depth" from which all relative shadows are computed.
 */
type DepthContextType = {
  focalDepth: number;
  setFocalDepth: (value: number) => void;
};

const DepthContext = createContext<DepthContextType>({
  focalDepth: 0,
  setFocalDepth: () => {},
});

export const ParallaxDepthController: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [focalDepth, setFocalDepth] = useState(0);
  return (
    <DepthContext.Provider value={{ focalDepth, setFocalDepth }}>
      {children}
    </DepthContext.Provider>
  );
};

export const useParallaxDepth = () => useContext(DepthContext);
