// SceneCore/Theme/layout.ts

export const WrldLayout = {
  spacing: {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
  },

  radii: {
    sm: 0.2,
    md: 0.5,
    lg: 1.0,
  },

  depth: {
    foreground: 10,
    mid: 0,
    background: -10,
  },
} as const;

export type SpacingKey = keyof typeof WrldLayout.spacing;
export type RadiusKey = keyof typeof WrldLayout.radii;
export type DepthKey = keyof typeof WrldLayout.depth;
