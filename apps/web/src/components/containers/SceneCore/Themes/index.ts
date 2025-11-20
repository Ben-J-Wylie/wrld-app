// SceneCore/Theme/index.ts

import { WrldColors } from "./Colors";
import { WrldTypography } from "./Typography";
import { WrldMaterials } from "./Materials";
import { WrldLighting } from "./Lighting";
import { WrldMotion } from "./Motion";
import { WrldLayout } from "./Layout";

export const WrldTheme = {
  colors: WrldColors,
  typography: WrldTypography,
  materials: WrldMaterials,
  lighting: WrldLighting,
  motion: WrldMotion,
  layout: WrldLayout,
} as const;

export type WrldThemeType = typeof WrldTheme;
