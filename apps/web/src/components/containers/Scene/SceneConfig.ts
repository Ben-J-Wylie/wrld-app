/**
 * SceneConfig
 * -----------------------------------------------------------------------------
 * Global configuration constants for your scene system.
 * Defines camera defaults, background dimensions, lighting, scroll smoothing,
 * and optional debug settings.
 */

export const SceneConfig = {
  camera: {
    baseFov: 50,
    positionZ: 10,
    near: 0.1,
    far: 100,
  },

  scene: {
    background: {
      widthWorld: 10,
      heightWorld: 30,
      depth: 0,
    },
  },

  lighting: {
    ambient: 0.5,
    directional: {
      position: [5, 5, 5],
      intensity: 0.8,
    },
  },

  scroll: {
    smoothness: 0.08, // damping for camera scroll interpolation
  },

  debug: {
    enabled: true,
  },
} as const;

export type SceneConfigType = typeof SceneConfig;
