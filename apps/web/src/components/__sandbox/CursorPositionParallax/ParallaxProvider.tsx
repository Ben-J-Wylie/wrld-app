import React, { createContext, useContext, useEffect, useState } from "react";

type ParallaxContextType = { x: number; y: number };
const ParallaxContext = createContext<ParallaxContextType>({ x: 0, y: 0 });

export const ParallaxProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setCoords({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <ParallaxContext.Provider value={coords}>
      {children}
    </ParallaxContext.Provider>
  );
};

export const useParallax = () => useContext(ParallaxContext);
