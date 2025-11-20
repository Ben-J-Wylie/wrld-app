// SceneCore/Theme/colors.ts

export const WrldColors = {
  primary: "#FF3366",
  secondary: "#00D1FF",
  accent: "#FFA400",

  text: "#FFFFFF",
  mutedText: "#595959",

  background: "#434343",
  panel: "#1A1A1A",

  success: "#0ECB81",
  warning: "#FFB800",
  danger: "#FF3B30",
} as const;

export type WrldColorKey = keyof typeof WrldColors;
