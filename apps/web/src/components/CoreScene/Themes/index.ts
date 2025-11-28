// SceneCore/Theme/index.ts

import { WrldColors } from "./Colors";

export const WrldTheme = {
  colors: WrldColors,
} as const;

export type WrldThemeType = typeof WrldTheme;
