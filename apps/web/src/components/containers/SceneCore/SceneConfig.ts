export type ScrollMode = "custom" | "dom";

export const SceneConfig = {
  camera: {
    baseFov: 50,
    positionZ: 10,
    near: 0.1,
    far: 100,
  },

  scene: {
    background: {
      worldWidth: 10,
      worldHeight: 30,
      depth: 0,
    },
  },

  lighting: {
    ambient: 0.3,
    directional: { position: [5, 5, 5], intensity: 1.2 },
    point: { position: [1, 1.5, 4], intensity: 5, distance: 50 },
},

  scroll: {
    smoothness: 0.08,
    mode: "custom" as ScrollMode, // 👈 explicit union type here
  },

  debug: {
    enabled: true,
  },
} as const;

export type SceneConfigType = typeof SceneConfig;

