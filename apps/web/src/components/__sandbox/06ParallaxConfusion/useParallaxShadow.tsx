import { useParallaxLight } from "./ParallaxLight";

/**
 * Returns a CSS-ready drop-shadow string that reacts to
 * both light direction and object depth.
 *
 *  depth = 0 → no shadow
 *  depth > 0 → longer, blurrier, lighter shadow
 *  depth < 0 → (optional) tiny, crisp shadow if desired
 */
export function useParallaxShadow(depth: number) {
  const { x, y, intensity, color } = useParallaxLight();

  // Clamp negatives to zero if you don’t want “far” objects casting any
  const effectiveDepth = Math.max(0, depth);

  if (effectiveDepth === 0) return "0px 0px 0px transparent";

  // Base tuning constants
  const baseDistance = 10; // px per depth unit
  const baseBlur = 10; // px per depth unit
  const baseOpacity = 1; // starting darkness

  // Derived values
  const distance = baseDistance * effectiveDepth;
  const blur = baseBlur * effectiveDepth * 1.2;
  const alpha = Math.max(0, baseOpacity - effectiveDepth * 0.07); // fades with depth

  // Compute direction (shadow falls opposite light)
  const offsetX = -x * distance;
  const offsetY = -y * distance;

  // Inject new alpha into rgba/hsla string
  const fadedColor = color.replace(/[\d.]+\)$/g, `${alpha})`);

  return `${offsetX.toFixed(2)}px ${offsetY.toFixed(2)}px ${blur.toFixed(
    2
  )}px ${fadedColor}`;
}
