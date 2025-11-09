// src/parallax/ParallaxConfig.ts
export const ParallaxConfig = {
  /** Camera behavior */
  camera: {
    fov: 50,           // Field of view (lower = flatter, higher = deeper)
    near: 0.1,
    far: 100,
    positionZ: 10,
  },

  /** Scroll and motion response */
  scroll: {
    rangeMultiplier: 0.15, // Overall parallax strength (0.1–0.3 typical)
    smoothness: 0.1,       // Camera lerp factor (higher = snappier)
  },

  /** Lighting */
  lighting: {
    ambient: 0.6,
    directional: {
      intensity: 0.4,
      position: [1, 2, 3] as [number, number, number],
    },
  },

  /** Default layer values for ParallaxGroup & ParallaxImage */
  layers: {
    defaultDepth: 1,
    defaultOpacity: 1,
    defaultWidth: 8,
    baseY: 0,
  },

  /** Scroll + resize monitoring */
  controller: {
    enabled: true,       // Set false to disable auto scroll/resize tracking
    normalizeScroll: true, // Keep scroll between 0–1
  },

  /** Debug / dev mode */
  debug: {
    enabled: false,
    showGrid: false,
    showAxes: false,
  },
};
