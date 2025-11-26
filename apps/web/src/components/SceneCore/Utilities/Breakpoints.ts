// Breakpoint.ts
import { useEffect } from "react";
import { useSceneStore, Breakpoint } from "../Store/SceneStore";

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

export function useBreakpointListener() {
  const setBreakpoint = useSceneStore((s) => s.setBreakpoint);

  useEffect(() => {
    function update() {
      const width = typeof window === "undefined" ? 1024 : window.innerWidth;

      const bp = resolveBreakpoint(width);
      setBreakpoint(bp);
    }

    update(); // call on mount

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [setBreakpoint]);
}
