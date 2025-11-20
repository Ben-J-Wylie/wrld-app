// SceneCore/Theme/lighting.ts

export interface LightingPreset {
  /** Main directional light intensity */
  directionalIntensity: number;
  /** Main directional light color */
  directionalColor: string;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Ambient light color */
  ambientColor: string;
  /** 0–1, how strong shadows should generally appear */
  shadowStrength: number;
}

export const WrldLighting: Record<string, LightingPreset> = {
  soft: {
    directionalIntensity: 1.2,
    directionalColor: "#ffffff",
    ambientIntensity: 0.35,
    ambientColor: "#202020",
    shadowStrength: 0.5,
  },
  dramatic: {
    directionalIntensity: 2.0,
    directionalColor: "#ffddcc",
    ambientIntensity: 0.2,
    ambientColor: "#080808",
    shadowStrength: 0.8,
  },
  cyberpunk: {
    directionalIntensity: 1.4,
    directionalColor: "#88ccff",
    ambientIntensity: 0.3,
    ambientColor: "#060918",
    shadowStrength: 0.6,
  },
};

export type LightingPresetKey = keyof typeof WrldLighting;
