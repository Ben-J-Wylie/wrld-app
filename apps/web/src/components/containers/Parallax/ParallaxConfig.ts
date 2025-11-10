// src/parallax/ParallaxConfig.ts
export const ParallaxConfig = {
  camera: {
    fov: 50,            // human-eye equivalent
    near: 0.1,          // units from the camera
    far: 10.1,          // units from the camera
    positionZ: 10,      // distance from origin
  },

  scroll: {
    smoothness: 0.1,    // how responsive the camera movement feels
  },

  scene: {
    // Defines the background plane geometry the camera traverses
    background: {
      heightWorld: 50,  // height of the backmost plane in world units
      depth: 0,         // its Z-position (world space)
    },

    // Optional defaults for layer creation convenience
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
