// SceneCore/Theme/motion.ts

export const WrldMotion = {
  durations: {
    fast: 0.15,
    medium: 0.3,
    slow: 0.6,
  },

  hover: {
    scale: 1.05, // how much to scale up on hover
    lift: 0.5, // how much to move in +Y on hover (world units)
  },

  damping: {
    camera: 0.05,
    object: 0.08,
  },
} as const;

export type MotionDurationKey = keyof typeof WrldMotion.durations;
