// src/parallax/ParallaxConfig.ts
export const ParallaxConfig = {
  camera: {
    baseFov: 50,        // boot / fallback FOV; overridden dynamically
    near: 0.1,          // camera near clipping plane
    far: 10.1,          // camera far clipping plane
    positionZ: 10,      // distance from origin (sets perspective strength)
  },

  scroll: {
    smoothness: 0.1,    // camera interpolation speed when scrolling
  },

  scene: {
    // Defines the background plane geometry that the camera frames
    background: {
      baseWidth: 1920,  // historical reference; now replaced by geometry width
      heightWorld: 50,
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
    enabled: false,
  },
};
