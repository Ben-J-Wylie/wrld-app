// -----------------------------------------------------
// Responsive resolution helper
// -----------------------------------------------------
export type BreakpointKey = "mobile" | "tablet" | "desktop";

/**
 * Runtime check + type predicate
 */
function isResponsiveObject<T>(
  value: any
): value is Partial<Record<BreakpointKey, T>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function resolveResponsive<T>(
  value: T | Partial<Record<BreakpointKey, T>> | undefined,
  bp: BreakpointKey,
  fallback: T
): T {
  // Completely undefined → fallback
  if (value === undefined) return fallback;

  // Primitive or array → use directly
  if (!isResponsiveObject<T>(value)) return value as T;

  // Responsive object → try breakpoints with fallback ordering
  return value[bp] ?? value.mobile ?? value.tablet ?? value.desktop ?? fallback;
}
