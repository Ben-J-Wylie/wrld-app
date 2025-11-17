export const BREAKPOINTS = {
  mobile: 0,
  tablet: 720,
  desktop: 1024,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Given a viewport width, return the Breakpoint name.
 */
export function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}
