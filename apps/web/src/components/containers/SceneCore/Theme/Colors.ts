// SceneCore/Theme/colors.ts

export const WrldColors = {
  primary: "#2d2d2d",
  secondary: "#444444",
  accent: "#838383",

  text: "#252525",
  mutedText: "#595959",

  background: "#e1e1db",
  panel: "#1A1A1A",

  success: "#0ECB81",
  warning: "#FFB800",
  danger: "#FF3B30",
} as const;

export type WrldColorKey = keyof typeof WrldColors;
