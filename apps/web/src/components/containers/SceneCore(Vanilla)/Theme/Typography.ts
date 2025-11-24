// SceneCore/Theme/typography.ts

import { WrldColors } from "./Colors";

export interface TextStylePreset {
  fontFamily: string;
  fontSize: number; // canvas px → you map to world in TextPlane
  color: string;
  padding: number;
}

export const WrldTypography = {
  family: "Inter",

  sizes: {
    xs: 50,
    sm: 80,
    md: 120,
    lg: 180,
    xl: 250,
  },

  presets: {
    title: {
      fontFamily: "Inter",
      fontSize: 220,
      color: WrldColors.text,
      padding: 24,
    } as TextStylePreset,

    subtitle: {
      fontFamily: "Inter",
      fontSize: 150,
      color: WrldColors.mutedText,
      padding: 20,
    } as TextStylePreset,

    body: {
      fontFamily: "Inter",
      fontSize: 90,
      color: WrldColors.text,
      padding: 16,
    } as TextStylePreset,

    label: {
      fontFamily: "Inter",
      fontSize: 70,
      color: WrldColors.mutedText,
      padding: 10,
    } as TextStylePreset,
  },
} as const;

export type TextPresetKey = keyof typeof WrldTypography.presets;
