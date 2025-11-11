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
    smoothness: 0.08,
    mode: "custom" as ScrollMode, // 👈 explicit union type here
  },

  debug: {
    enabled: true,
  },
} as const;

export type SceneConfigType = typeof SceneConfig;

