// src/parallax/ParallaxConfig.ts
export const ParallaxConfig = {
  camera: {
    baseFov: 50,        // boot / fallback FOV; overridden dynamically
    near: 0.1,          // camera near clipping plane
    far: 100,          // camera far clipping plane
    positionZ: 50,      // distance from origin (sets perspective strength)
  },

scroll: {
    baseWheelSpeed: 0.0012,
    baseTouchSpeed: 0.0025,
    baseKeySpeed: 0.4,
    damping: .1,
    spring: 1,
    smoothness: .5, // (optional: used by CameraRig)
  },

  scene: {
  background: {
    widthWorld: 10,   
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
    enabled: true,
  },
};
