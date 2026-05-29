// src/canvas/stage/tokens.ts
//
// Token-to-RGBA bridge for the canvas tier.
//
// See DESIGN.md 0.3: canvas code consumes RESOLVED token values (an actual
// RGBA / hex triple usable by DataTexture or a shader uniform), not semantic
// tokens as style props. This module is the single, universal-from-day-one
// inhabitant of `canvas/stage/` that every scene element can reach for.
//
// Scenes import from here (one-way down to tokens); nothing inside this file
// imports back upward into components, features, or screens.

import { theme } from '@/tokens/theme'

export type RGB = readonly [number, number, number]

/** Parse `#rrggbb` or `#rgb` into a [r, g, b] tuple of 0-255 ints. */
export function hexToRgb(hex: string): RGB {
  const m = hex.replace(/^#/, '')
  const v = parseInt(
    m.length === 3 ? m.split('').map(c => c + c).join('') : m,
    16,
  )
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]
}

/**
 * Resolve a semantic color token (`theme.colors.<name>`) to its [r, g, b]
 * triple. Use this anywhere a scene element draws a color sourced from the
 * theme — e.g. pin fill, glow, accent ring.
 *
 * The set of valid tokens is derived from `theme.colors`, so this stays
 * honest against the active palette without scenes having to know hex
 * strings directly.
 */
export function resolveColor(
  token: keyof typeof theme.colors,
): RGB {
  const value = theme.colors[token]
  if (typeof value !== 'string') {
    throw new Error(`canvas/stage/tokens: ${String(token)} is not a hex string`)
  }
  return hexToRgb(value)
}
