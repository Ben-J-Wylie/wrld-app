// utils/damp.ts
export function damp(
  current: number,
  target: number,
  lambda: number,
  dt: number
) {
  // lambda: smoothing factor (recommended 0.1–0.2)
  // dt: delta time from engine loop (in seconds)
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
