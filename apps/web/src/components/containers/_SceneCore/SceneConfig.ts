// @ts-nocheck

export type ScrollMode = "custom" | "dom";

export const SceneConfig = {
  camera: {
    baseFov: 50,
    positionZ: 100,
    near: 0.1,
    far: 120,
  },

  scene: {
    background: {
      sceneWidth: 10,
      sceneHeight: 50,
      depth: 0,
      color: "#ffffff",
    },
  },

  lighting: {
    ambient: {
      intensity: 0.1,
      color: "#ffffff",
},

    // directional: {
    //   position: [-30, 30, 100] as [number, number, number],
    //   target: [0, 0, 1] as [number, number, number],
      
    //   intensity: 1,
    //   color: "#ffffff",
      
    //   castShadow: true,
    //   shadow: {
    //     bias: -0.00015,
    //     normalBias: 0.05,
    //     radius: 2,  
    //     mapSize: [512, 512] as [number, number],
    //     camera: {
    //       near: 50,
    //       far: 150,
    //       left: -20,
    //       right: 20,
    //       top: 20,
    //       bottom: -20,
    //     },
    //   },
    // },
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
