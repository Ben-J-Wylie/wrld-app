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
      sceneWidth: 10,
      sceneHeight: 30,
      depth: 0,
      color: "#dddddd",
    },
  },

  lighting: {
    ambient: .3,

    directional: {
      position: [0, 0, 10] as [number, number, number],
      target: [0, 0, 0] as [number, number, number],
      
      color: "#ffffff",
      intensity: 1,

      castShadow: true,
      shadow: {
        bias: -0.0005,
        normalBias: 0.02,
        radius: 2,
        mapSize: [2048, 2048] as [number, number],
        camera: {
          near: 0,
          far: 20,
          left: -10,
          right: 10,
          top: 100,
          bottom: -10,
        },
      },
    },
  },

  scroll: {
    smoothness: 0.08,
    mode: "custom" as ScrollMode,
  },

  debug: {
    enabled: true,
  },
} as const;

export type SceneConfigType = typeof SceneConfig;
