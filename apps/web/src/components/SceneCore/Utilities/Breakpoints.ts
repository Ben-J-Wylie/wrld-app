// useBreakpoint.ts
import { useState, useEffect } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

export const BREAKPOINTS = {
  mobile: 0,
  tablet: 720,
  desktop: 1024,
};

function resolveBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(
    resolveBreakpoint(window.innerWidth)
  );

  useEffect(() => {
    function onResize() {
      setBp(resolveBreakpoint(window.innerWidth));
    }

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return bp;
}
