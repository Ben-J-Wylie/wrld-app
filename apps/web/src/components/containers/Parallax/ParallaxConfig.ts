// src/parallax/ParallaxConfig.ts
export const ParallaxConfig = {
  camera: {
    baseFov: 50,        // boot / fallback FOV; overridden dynamically
    near: 0.1,          // camera near clipping plane
    far: 100,          // camera far clipping plane
    positionZ: 10,      // distance from origin (sets perspective strength)
  },

  scroll: {
    smoothness: 0.1,    // camera interpolation speed when scrolling
  },

  scene: {
  background: {
    widthWorld: 10,   
    heightWorld: 15,
    depth: 0,
  },

    // Default layer settings (useful for mid / front layers)
    layerDefaults: {
      width: 8,
      opacity: 1,
      baseY: 0,
    },
  },

  lighting: {
    ambient: 0.6,
    directional: {
      intensity: 0.4,
      position: [1, 2, 3] as [number, number, number],
    },
  },

  debug: {
    enabled: true,
  },
};
