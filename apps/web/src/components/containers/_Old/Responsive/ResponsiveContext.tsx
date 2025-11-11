import React, { createContext, useContext, useEffect, useState } from "react";
import { BREAKPOINTS, GLOBAL_PARAMS } from "./responsiveConfig";

type Device = "mobile" | "tablet" | "desktop";

type ResponsiveState = {
  width: number;
  height: number;
  device: Device;
  scale: number;
  parallaxStrength: number;
  shadowBlur: number;
  shadowOpacity: number;
  shadowGrowth: number;
  shadowOffsetScale: number;
  shadowFalloff: number;
};

const defaultState: ResponsiveState = {
  width: 0,
  height: 0,
  device: "desktop",
  scale: GLOBAL_PARAMS.scaleFactor.desktop,
  parallaxStrength: GLOBAL_PARAMS.parallaxStrength.desktop,
  shadowBlur: GLOBAL_PARAMS.shadow.blur.desktop,
  shadowOpacity: GLOBAL_PARAMS.shadow.opacity.desktop,
  shadowGrowth: GLOBAL_PARAMS.shadow.growth.desktop,
  shadowOffsetScale: GLOBAL_PARAMS.shadow.offsetScale.desktop,
  shadowFalloff: GLOBAL_PARAMS.shadow.falloff.desktop,
};

const ResponsiveContext = createContext<ResponsiveState>(defaultState);

export const ResponsiveProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState(defaultState);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      let device: Device = "desktop";
      if (w < BREAKPOINTS.mobile) device = "mobile";
      else if (w < BREAKPOINTS.tablet) device = "tablet";

      setState({
        width: w,
        height: h,
        device,
        scale: GLOBAL_PARAMS.scaleFactor[device],
        parallaxStrength: GLOBAL_PARAMS.parallaxStrength[device],
        shadowBlur: GLOBAL_PARAMS.shadow.blur[device],
        shadowOpacity: GLOBAL_PARAMS.shadow.opacity[device],
        shadowGrowth: GLOBAL_PARAMS.shadow.growth[device],
        shadowOffsetScale: GLOBAL_PARAMS.shadow.offsetScale[device],
        shadowFalloff: GLOBAL_PARAMS.shadow.falloff[device],
      });
    };

    window.addEventListener("resize", update);
    update();
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <ResponsiveContext.Provider value={state}>
      {children}
    </ResponsiveContext.Provider>
  );
};

export const useResponsiveContext = () => useContext(ResponsiveContext);
