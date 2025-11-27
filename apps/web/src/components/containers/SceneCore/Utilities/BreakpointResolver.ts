// -------------------------------------------------------
// BreakpointResolver.ts
// Centralized resolver for responsive values
// -------------------------------------------------------

import type { Breakpoint } from "../Store/SceneStore";

export type ResponsiveValue<T> = T | Partial<Record<Breakpoint, T>>;

// -------------------------------------------------------
// Check if a value is a responsive object
// -------------------------------------------------------
function isResponsiveObject<T>(
  value: any
): value is Partial<Record<Breakpoint, T>> {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("mobile" in value || "tablet" in value || "desktop" in value)
  );
}

// -------------------------------------------------------
// Resolve any responsive value for the given breakpoint
// -------------------------------------------------------
export function resolveResponsive<T>(
  value: ResponsiveValue<T>,
  bp: Breakpoint
): T {
  // Simple/static values, or undefined
  if (!isResponsiveObject<T>(value)) {
    return value as T;
  }

  // Try exact match first
  const exact = value[bp];
  if (exact !== undefined) return exact;

  // Fallback priority: desktop → tablet → mobile
  return value.desktop ?? value.tablet ?? value.mobile ?? (undefined as any);
}

// -------------------------------------------------------
// Utility: merge z override into a vector
// -------------------------------------------------------
export function mergeZ(
  base: [number, number, number],
  zOverride?: number
): [number, number, number] {
  if (zOverride === undefined) return base;
  return [base[0], base[1], zOverride];
}
